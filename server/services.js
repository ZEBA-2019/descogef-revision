/**
 * Services applicatifs : accès aux données et orchestration de la logique métier (dossier shared/).
 */
import { all, one, run, parseJson } from './db.js';
import { computeProgress, weakChapters, recurringErrors, streakDays, isExamReady } from '../shared/progress.js';
import { gradeAnswer } from '../shared/scoring.js';
import { recommendNext } from '../shared/recommend.js';
import { ACTIVITIES } from '../shared/planner.js';

/* ---------------------------- Contenu ---------------------------- */

export function getSubjects() {
  return all('SELECT * FROM subjects ORDER BY position, id');
}
export function getChapters() {
  return all('SELECT c.*, s.title AS subject_title FROM chapters c JOIN subjects s ON s.id = c.subject_id ORDER BY s.position, c.position, c.id');
}

/** Arborescence matières > chapitres avec compteurs de contenus. */
export async function getProgramTree() {
  const subjects = await getSubjects();
  const chapters = await all(`
    SELECT c.*,
      (SELECT COUNT(*) FROM sheets WHERE chapter_id = c.id) AS sheets_count,
      (SELECT COUNT(*) FROM questions WHERE chapter_id = c.id) AS questions_count,
      (SELECT COUNT(*) FROM flashcards WHERE chapter_id = c.id) AS flashcards_count,
      (SELECT COUNT(*) FROM exercises WHERE chapter_id = c.id) AS exercises_count,
      (SELECT COUNT(*) FROM lessons WHERE chapter_id = c.id) AS lessons_count
    FROM chapters c ORDER BY c.position, c.id`);
  return subjects.map((s) => ({ ...s, chapters: chapters.filter((c) => c.subject_id === s.id) }));
}

/** Questions complètes (avec réponses) – usage serveur uniquement. */
export async function loadQuestions(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const qs = await all(
    `SELECT q.*, c.subject_id, c.title AS chapter_title, s.title AS subject_title
     FROM questions q JOIN chapters c ON c.id = q.chapter_id JOIN subjects s ON s.id = c.subject_id
     WHERE q.id IN (${placeholders})`,
    ...ids
  );
  const choices = await all(`SELECT * FROM choices WHERE question_id IN (${placeholders}) ORDER BY position, id`, ...ids);
  const byId = new Map(
    qs.map((q) => [q.id, { ...q, answer: parseJson(q.answer, {}), choices: choices.filter((c) => c.question_id === q.id) }])
  );
  return ids.map((id) => byId.get(Number(id))).filter(Boolean);
}

/** Version publique d'une question : aucune information sur la bonne réponse. */
export function publicQuestion(q) {
  const base = {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    difficulty: q.difficulty,
    competency: q.competency,
    chapterId: q.chapter_id,
    chapterTitle: q.chapter_title,
    subjectId: q.subject_id,
    subjectTitle: q.subject_title,
  };
  if (q.type === 'mcq') {
    base.choices = q.choices.map((c) => ({ id: c.id, label: c.label }));
    base.multiple = q.choices.filter((c) => c.is_correct).length > 1;
  }
  if (q.type === 'match') base.match = { left: q.answer.left || [], right: q.answer.right || [] };
  if (q.type === 'calc') base.unit = q.answer.unit || '';
  return base;
}

/** Correction détaillée renvoyée après une réponse. */
export function correction(q, userAnswer) {
  const g = gradeAnswer(q, userAnswer);
  const out = { correct: g.correct, score: g.score, explanation: q.explanation, expected: g.expected };
  if (q.type === 'mcq') {
    const given = new Set((Array.isArray(userAnswer) ? userAnswer : [userAnswer]).map(Number));
    out.choices = q.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: Boolean(c.is_correct), selected: given.has(c.id), feedback: c.feedback }));
    out.expectedLabel = q.choices.filter((c) => c.is_correct).map((c) => c.label).join(' ; ');
  } else if (q.type === 'truefalse') {
    out.expectedLabel = g.expected ? 'Vrai' : 'Faux';
  } else if (q.type === 'calc') {
    out.expectedLabel = `${new Intl.NumberFormat('fr-FR').format(g.expected)}${q.answer.unit ? ' ' + q.answer.unit : ''}`;
  } else if (q.type === 'short') {
    out.expectedLabel = g.expected;
  } else if (q.type === 'match') {
    out.expectedLabel = (q.answer.pairs || []).map(([l, r]) => `${q.answer.left[l]} → ${q.answer.right[r]}`).join(' ; ');
  }
  return out;
}

/* ---------------------------- Résultats & temps ---------------------------- */

export async function recordResult({ attemptId, userId, question, answer, grade, timeSec }) {
  await run(
    `INSERT INTO results (attempt_id, user_id, question_id, item_index, subject_id, chapter_id, difficulty, competency, answer, is_correct, score, time_sec)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    attemptId, userId, question.id, question.subject_id, question.chapter_id, question.difficulty, question.competency,
    JSON.stringify(answer ?? null), grade.correct ? 1 : 0, grade.score, Math.max(0, Math.min(3600, Math.round(timeSec || 0)))
  );
}

export async function logStudy({ userId, activity, subjectId = null, chapterId = null, durationSec }) {
  const d = Math.round(Number(durationSec) || 0);
  if (d <= 0) return;
  await run('INSERT INTO study_sessions (user_id, activity, subject_id, chapter_id, duration_sec) VALUES (?, ?, ?, ?, ?)', userId, activity, subjectId, chapterId, Math.min(d, 6 * 3600));
}

/* ---------------------------- Progression ---------------------------- */

/** Progression de l'utilisateur. `excludeAttemptId` permet de calculer l'état « avant » une série. */
export async function userProgress(userId, { excludeAttemptId = null } = {}) {
  const [subjects, chapters, results, sheets] = await Promise.all([
    getSubjects(),
    getChapters(),
    all(
      `SELECT r.chapter_id, r.score, r.difficulty, r.created_at, r.competency
       FROM results r WHERE r.user_id = ? AND r.question_id IS NOT NULL AND r.attempt_id IS DISTINCT FROM ?::int`,
      userId, excludeAttemptId
    ),
    all(
    `SELECT sh.id, sh.chapter_id, COALESCE(ss.status, 'a_decouvrir') AS status
       FROM sheets sh LEFT JOIN sheet_status ss ON ss.sheet_id = sh.id AND ss.user_id = ?`,
      userId
    ),
  ]);
  return { ...computeProgress({ subjects, chapters, results, sheets }), results };
}

export async function dueFlashcardsCount(userId) {
  const now = new Date().toISOString();
  const row = await one(
    `SELECT COUNT(*) AS n FROM flashcards f
     JOIN flashcard_states st ON st.flashcard_id = f.id AND st.user_id = ?
     WHERE st.due_at <= ?`,
    userId, now
  );
  return row.n;
}

export async function newFlashcardsCount(userId) {
  const row = await one(
    `SELECT COUNT(*) AS n FROM flashcards f
     WHERE NOT EXISTS (SELECT 1 FROM flashcard_states st WHERE st.flashcard_id = f.id AND st.user_id = ?)`,
    userId
  );
  return row.n;
}

export function planItemLabel(it) {
  const act = ACTIVITIES[it.activity] || it.activity;
  return it.chapter_title ? `${act} — ${it.chapter_title}` : act;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function planItems(userId, from, to) {
  const rows = await all(
    `SELECT pi.*, c.title AS chapter_title, s.title AS subject_title, s.code AS subject_code
     FROM plan_items pi
     LEFT JOIN chapters c ON c.id = pi.chapter_id
     LEFT JOIN subjects s ON s.id = pi.subject_id
     WHERE pi.user_id = ? AND pi.date BETWEEN ? AND ?
     ORDER BY pi.date, pi.id`,
    userId, from, to
  );
  return rows.map((it) => ({ ...it, label: planItemLabel(it) }));
}

/** Données synthétiques communes au tableau de bord et aux statistiques. */
export async function buildRecommendation(user, progress) {
  const today = todayISO();
  // Une seule réponse fausse suffit à signaler un chapitre fragile ; la priorité tient compte de la confiance
  const weak = weakChapters(progress.chapters, { minCount: 1 });
  const untouched = progress.chapters.filter((c) => c.count === 0);
  const examReady = isExamReady(progress);
  return recommendNext({
    diagnosticDone: Boolean(user.diagnostic_done),
    dueFlashcards: await dueFlashcardsCount(user.id),
    weak,
    untouched,
    todayPlan: await planItems(user.id, today, today),
    examReady,
  });
}

export async function dashboard(user) {
  const progress = await userProgress(user.id);
  const time = await one(
    `SELECT COALESCE(SUM(duration_sec), 0) AS total,
            COALESCE(SUM(CASE WHEN created_at >= ? THEN duration_sec END), 0) AS week
     FROM study_sessions WHERE user_id = ?`,
    new Date(Date.now() - 7 * 86_400_000).toISOString(), user.id
  );
  const answered = progress.results.length;
  const correct = progress.results.filter((r) => r.score >= 1).length;
  const recent = (await all(
    `SELECT a.id, a.kind, a.score, a.percent, a.finished_at, a.duration_sec, a.config,
            (SELECT COUNT(*) FROM results r WHERE r.attempt_id = a.id) AS answered
     FROM attempts a WHERE a.user_id = ? AND a.status = 'termine'
     ORDER BY a.finished_at DESC LIMIT 6`,
    user.id
  )).map((a) => ({ ...a, config: parseJson(a.config, {}) }));
  const activityDates = (await all(
    `SELECT DISTINCT substr(created_at, 1, 10) AS d FROM study_sessions WHERE user_id = ?
     UNION SELECT DISTINCT substr(created_at, 1, 10) FROM results WHERE user_id = ?`,
    user.id, user.id
  )).map((r) => r.d);
  const today = todayISO();
  return {
    overall: progress.overall,
    subjects: progress.subjects,
    weak: weakChapters(progress.chapters, { minCount: 1 }),
    timeTotalSec: time.total,
    timeWeekSec: time.week,
    successRate: answered ? correct / answered : null,
    answered,
    streak: streakDays(activityDates),
    recent,
    dueFlashcards: await dueFlashcardsCount(user.id),
    newFlashcards: await newFlashcardsCount(user.id),
    todayPlan: await planItems(user.id, today, today),
    recommendation: await buildRecommendation(user, progress),
    examDate: user.exam_date,
  };
}

export async function stats(user) {
  const progress = await userProgress(user.id);
  const timeline = await all(
    `SELECT id, kind, percent, score, finished_at FROM attempts
     WHERE user_id = ? AND status = 'termine' AND percent IS NOT NULL ORDER BY finished_at`,
    user.id
  );
  const errors = recurringErrors(progress.results);
  const missed = await all(
    `SELECT q.id, q.prompt, c.title AS chapter_title,
            COUNT(*) AS attempts, SUM(CASE WHEN r.score < 1 THEN 1 ELSE 0 END) AS errors
     FROM results r JOIN questions q ON q.id = r.question_id JOIN chapters c ON c.id = q.chapter_id
     WHERE r.user_id = ? GROUP BY q.id, q.prompt, c.title
     HAVING SUM(CASE WHEN r.score < 1 THEN 1 ELSE 0 END) > 0 ORDER BY errors DESC, attempts DESC LIMIT 5`,
    user.id
  );
  const timeByActivity = await all(
    'SELECT activity, SUM(duration_sec) AS seconds FROM study_sessions WHERE user_id = ? GROUP BY activity ORDER BY seconds DESC',
    user.id
  );
  const byDifficulty = [1, 2, 3].map((d) => {
    const rs = progress.results.filter((r) => r.difficulty === d);
    return { difficulty: d, count: rs.length, accuracy: rs.length ? rs.filter((r) => r.score >= 1).length / rs.length : null };
  });
  return {
    overall: progress.overall,
    subjects: progress.subjects,
    chapters: progress.chapters,
    timeline,
    errors,
    missed,
    timeByActivity,
    byDifficulty,
    recommendation: await buildRecommendation(user, progress),
  };
}
