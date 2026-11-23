/**
 * Quiz, diagnostic initial et examens blancs.
 * Parcours : démarrer une tentative -> répondre (correction immédiate) -> terminer (score + progression).
 */
import { Router } from 'express';
import { z } from 'zod';
import { all, one, run, tx, parseJson } from '../db.js';
import { handler, validate, HttpError, toId } from '../http.js';
import { requireAuth } from '../auth.js';
import { gradeAnswer, computeAttemptScore, mention } from '../../shared/scoring.js';
import { loadQuestions, publicQuestion, correction, recordResult, logStudy, userProgress, getSubjects } from '../services.js';

const router = Router();
router.use(requireAuth);

const QUESTION_TYPES = ['mcq', 'truefalse', 'short', 'calc', 'match'];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAttempt(req, kinds) {
  const a = one('SELECT * FROM attempts WHERE id = ? AND user_id = ?', toId(req.params.id), req.user.id);
  if (!a) throw new HttpError(404, 'Tentative introuvable.');
  if (kinds && !kinds.includes(a.kind)) throw new HttpError(400, 'Type de tentative incompatible.');
  return { ...a, config: parseJson(a.config, {}), state: parseJson(a.state, {}) };
}

/**
 * Sélection des questions.
 * - mode « personnalise » : filtres + priorité aux questions peu vues
 * - mode « adaptatif » : priorité aux chapitres faibles, aux erreurs passées et aux questions jamais vues
 */
function selectQuestions(userId, { mode, subjectId, chapterId, difficulty, types, count }) {
  const where = ['1 = 1'];
  const params = [];
  if (chapterId) { where.push('q.chapter_id = ?'); params.push(chapterId); }
  else if (subjectId) { where.push('c.subject_id = ?'); params.push(subjectId); }
  if (difficulty) { where.push('q.difficulty = ?'); params.push(difficulty); }
  if (types?.length) { where.push(`q.type IN (${types.map(() => '?').join(',')})`); params.push(...types); }

  const pool = all(
    `SELECT q.id, q.chapter_id,
       (SELECT COUNT(*) FROM results r WHERE r.question_id = q.id AND r.user_id = ?) AS seen,
       (SELECT r.score FROM results r WHERE r.question_id = q.id AND r.user_id = ? ORDER BY r.created_at DESC LIMIT 1) AS last_score,
       (SELECT r.created_at FROM results r WHERE r.question_id = q.id AND r.user_id = ? ORDER BY r.created_at DESC LIMIT 1) AS last_at
     FROM questions q JOIN chapters c ON c.id = q.chapter_id WHERE ${where.join(' AND ')}`,
    userId, userId, userId, ...params
  );
  if (!pool.length) return [];

  let mastery = new Map();
  if (mode === 'adaptatif') {
    mastery = new Map(userProgress(userId).chapters.map((c) => [c.chapterId, c.mastery * c.confidence]));
  }
  const dayAgo = Date.now() - 86_400_000;
  const scored = pool.map((q) => {
    let s = Math.random();
    if (q.seen === 0) s += 1;
    else s -= Math.min(1, q.seen * 0.2);
    if (q.last_score != null && q.last_score < 1) s += 1.5;
    if (q.last_score >= 1 && q.last_at && new Date(q.last_at).getTime() > dayAgo) s -= 1.5;
    if (mode === 'adaptatif') s += 2 * (1 - (mastery.get(q.chapter_id) ?? 0));
    return { id: q.id, s };
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, count).map((q) => q.id);
}

function createAttempt(userId, kind, questionIds, config, extraState = {}) {
  const state = { questionIds, answered: {}, ...extraState };
  const { lastInsertRowid } = run(
    'INSERT INTO attempts (user_id, kind, config, state) VALUES (?, ?, ?, ?)',
    userId, kind, JSON.stringify(config), JSON.stringify(state)
  );
  return Number(lastInsertRowid);
}

function attemptPayload(a) {
  const questions = loadQuestions(a.state.questionIds || []);
  const results = all('SELECT question_id, answer FROM results WHERE attempt_id = ?', a.id);
  const answered = {};
  for (const r of results) {
    const q = questions.find((x) => x.id === r.question_id);
    if (q) answered[q.id] = { answer: parseJson(r.answer, null), ...correction(q, parseJson(r.answer, null)) };
  }
  return {
    id: a.id,
    kind: a.kind,
    status: a.status,
    config: a.config,
    startedAt: a.started_at,
    questions: questions.map(publicQuestion),
    answered: a.kind === 'examen' && a.status !== 'termine' ? {} : answered,
    state: a.kind === 'examen' ? { answers: a.state.answers || {}, currentIndex: a.state.currentIndex || 0, deadline: a.state.deadline } : undefined,
  };
}

/* ------------------------------ Quiz ------------------------------ */

const startSchema = z.object({
  mode: z.enum(['personnalise', 'adaptatif']).default('personnalise'),
  subjectId: z.coerce.number().int().positive().optional().nullable(),
  chapterId: z.coerce.number().int().positive().optional().nullable(),
  difficulty: z.coerce.number().int().min(1).max(3).optional().nullable(),
  types: z.array(z.enum(QUESTION_TYPES)).optional(),
  count: z.coerce.number().refine((n) => [5, 10, 20, 40].includes(n), 'Choisissez 5, 10, 20 ou 40 questions.').default(10),
});

router.post('/quiz/start', handler((req, res) => {
  const opts = validate(startSchema, req.body || {});
  const ids = selectQuestions(req.user.id, opts);
  if (!ids.length) throw new HttpError(404, 'Aucune question ne correspond à ces critères. Élargissez votre sélection.');
  const id = createAttempt(req.user.id, 'quiz', ids, { ...opts, requested: opts.count, available: ids.length });
  res.status(201).json({ attempt: attemptPayload(getAttempt({ params: { id }, user: req.user })) });
}));

/* ------------------------------ Diagnostic ------------------------------ */

router.post('/diagnostic/start', handler((req, res) => {
  const existing = one("SELECT id FROM attempts WHERE user_id = ? AND kind = 'diagnostic' AND status = 'en_cours' ORDER BY id DESC", req.user.id);
  if (existing) return res.json({ attempt: attemptPayload(getAttempt({ params: { id: existing.id }, user: req.user })) });
  const ids = all(
    `SELECT q.id FROM questions q JOIN chapters c ON c.id = q.chapter_id JOIN subjects s ON s.id = c.subject_id
     WHERE q.is_diagnostic = 1 ORDER BY s.position, c.position, q.position`
  ).map((r) => r.id);
  if (!ids.length) throw new HttpError(404, 'Aucune question de diagnostic n’est configurée. Contactez l’administrateur.');
  const id = createAttempt(req.user.id, 'diagnostic', ids, {});
  res.status(201).json({ attempt: attemptPayload(getAttempt({ params: { id }, user: req.user })) });
}));

/* ------------------------------ Tentatives (quiz + diagnostic) ------------------------------ */

router.get('/attempts/:id', handler((req, res) => {
  const a = getAttempt(req);
  if (a.kind === 'examen') maybeAutoSubmitExam(a);
  res.json({ attempt: attemptPayload(getAttempt(req)) });
}));

const answerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  answer: z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.coerce.number()).max(20), z.record(z.coerce.number()), z.null()]),
  timeSec: z.coerce.number().min(0).max(3600).default(0),
});

/** Enregistre une réponse et renvoie la correction immédiate. */
router.post('/attempts/:id/answer', handler((req, res) => {
  const a = getAttempt(req, ['quiz', 'diagnostic']);
  if (a.status !== 'en_cours') throw new HttpError(409, 'Cette série est déjà terminée.');
  const data = validate(answerSchema, req.body);
  if (!a.state.questionIds.includes(data.questionId)) throw new HttpError(400, 'Cette question ne fait pas partie de la série.');
  if (one('SELECT id FROM results WHERE attempt_id = ? AND question_id = ?', a.id, data.questionId)) {
    throw new HttpError(409, 'Vous avez déjà répondu à cette question.');
  }
  const [q] = loadQuestions([data.questionId]);
  const grade = gradeAnswer(q, data.answer);
  recordResult({ attemptId: a.id, userId: req.user.id, question: q, answer: data.answer, grade, timeSec: data.timeSec });
  run("UPDATE attempts SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", a.id);
  res.json({ correction: correction(q, data.answer) });
}));

/** Calcule le score, met à jour la progression et renvoie le bilan avant/après. */
function finishAttempt(a, user) {
  const results = all('SELECT * FROM results WHERE attempt_id = ?', a.id);
  const score = computeAttemptScore(results);
  const duration = results.reduce((s, r) => s + r.time_sec, 0);
  const before = userProgress(user.id, { excludeAttemptId: a.id });
  tx(() => {
    run(
      `UPDATE attempts SET status = 'termine', finished_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
        duration_sec = ?, score = ?, percent = ? WHERE id = ?`,
      a.kind === 'examen' ? a.duration_sec : duration, score.outOf20, score.percent, a.id
    );
    const bySubject = new Map();
    for (const r of results) bySubject.set(r.subject_id, (bySubject.get(r.subject_id) || 0) + r.time_sec);
    if (a.kind !== 'examen') {
      for (const [subjectId, sec] of bySubject) logStudy({ userId: user.id, activity: a.kind, subjectId, durationSec: sec });
    }
  });
  const after = userProgress(user.id);
  return { score, before, after, results };
}

function summarize(a, { score, before, after, results }) {
  const subjects = after.subjects.map((s) => {
    const b = before.subjects.find((x) => x.subjectId === s.subjectId);
    const rs = results.filter((r) => r.subject_id === s.subjectId);
    return { ...s, before: b?.progress ?? 0, delta: Math.round((s.progress - (b?.progress ?? 0)) * 10) / 10, answeredHere: rs.length, correctHere: rs.filter((r) => r.score >= 1).length };
  });
  const chapters = after.chapters
    .filter((c) => results.some((r) => r.chapter_id === c.chapterId))
    .map((c) => ({ ...c, before: before.chapters.find((x) => x.chapterId === c.chapterId)?.progress ?? 0 }));
  const competencies = {};
  for (const r of results) {
    const k = r.competency || 'Non classé';
    competencies[k] ??= { competency: k, total: 0, correct: 0 };
    competencies[k].total += 1;
    if (r.score >= 1) competencies[k].correct += 1;
  }
  return {
    attemptId: a.id,
    kind: a.kind,
    score: { ...score, mention: mention(score.outOf20) },
    overallBefore: before.overall,
    overallAfter: after.overall,
    subjects,
    chapters,
    toReinforce: Object.values(competencies).filter((c) => c.correct / c.total < 0.6).sort((x, y) => x.correct / x.total - y.correct / y.total),
  };
}

router.post('/attempts/:id/finish', handler((req, res) => {
  const a = getAttempt(req, ['quiz', 'diagnostic']);
  if (a.status !== 'en_cours') throw new HttpError(409, 'Cette série est déjà terminée.');
  const answeredCount = one('SELECT COUNT(*) AS n FROM results WHERE attempt_id = ?', a.id).n;
  if (!answeredCount) throw new HttpError(400, 'Répondez à au moins une question avant de terminer.');

  if (a.kind === 'diagnostic') {
    const data = validate(
      z.object({
        levels: z.record(z.coerce.number().int().min(1).max(5)).default({}),
        examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date d’examen invalide.').nullable().optional(),
      }),
      req.body || {}
    );
    const validIds = new Set(getSubjects().map((s) => String(s.id)));
    const levels = Object.fromEntries(Object.entries(data.levels).filter(([k]) => validIds.has(k)));
    run('UPDATE users SET diagnostic_done = 1, levels = ?, exam_date = COALESCE(?, exam_date) WHERE id = ?', JSON.stringify(levels), data.examDate ?? null, req.user.id);
  }
  const out = finishAttempt(a, req.user);
  res.json({ summary: summarize(a, out) });
}));

router.get('/attempts/:id/summary', handler((req, res) => {
  const a = getAttempt(req);
  if (a.status !== 'termine') throw new HttpError(409, 'Cette tentative n’est pas terminée.');
  const results = all('SELECT * FROM results WHERE attempt_id = ?', a.id);
  const after = userProgress(req.user.id);
  const before = userProgress(req.user.id, { excludeAttemptId: a.id });
  res.json({ summary: { ...summarize(a, { score: computeAttemptScore(results), before, after, results }), durationSec: a.duration_sec, finishedAt: a.finished_at } });
}));

router.get('/history', handler((req, res) => {
  const rows = all(
    `SELECT a.id, a.kind, a.status, a.score, a.percent, a.started_at, a.finished_at, a.duration_sec, a.exam_id, a.exercise_id,
       e.title AS exam_title, x.title AS exercise_title,
       (SELECT COUNT(*) FROM results r WHERE r.attempt_id = a.id) AS answered
     FROM attempts a LEFT JOIN exams e ON e.id = a.exam_id LEFT JOIN exercises x ON x.id = a.exercise_id
     WHERE a.user_id = ? ORDER BY a.started_at DESC LIMIT 100`,
    req.user.id
  );
  res.json({ attempts: rows });
}));

/* ------------------------------ Examens blancs ------------------------------ */

/** Génère un sujet équilibré : n questions par matière, selon un mélange de difficultés. */
function generateExamQuestions(config) {
  const perSubject = config.perSubject || 4;
  const mix = config.difficultyMix || { 1: 2, 2: 1, 3: 1 };
  const ids = [];
  for (const s of getSubjects()) {
    const pool = all('SELECT q.id, q.difficulty FROM questions q JOIN chapters c ON c.id = q.chapter_id WHERE c.subject_id = ?', s.id);
    const picked = [];
    for (const [d, n] of Object.entries(mix)) {
      picked.push(...shuffle(pool.filter((q) => q.difficulty === Number(d) && !picked.includes(q.id))).slice(0, n).map((q) => q.id));
    }
    const rest = shuffle(pool.filter((q) => !picked.includes(q.id))).map((q) => q.id);
    while (picked.length < perSubject && rest.length) picked.push(rest.shift());
    ids.push(...picked.slice(0, perSubject));
  }
  return ids;
}

router.get('/exams', handler((req, res) => {
  const exams = all('SELECT id, title, description, duration_min, config, is_demo FROM exams ORDER BY id').map((e) => ({ ...e, config: parseJson(e.config, {}) }));
  const attempts = all(
    `SELECT a.id, a.exam_id, a.status, a.score, a.percent, a.started_at, a.finished_at, a.duration_sec
     FROM attempts a WHERE a.user_id = ? AND a.kind = 'examen' ORDER BY a.started_at DESC`,
    req.user.id
  );
  res.json({ exams, attempts });
}));

router.post('/exams/:id/start', handler((req, res) => {
  const exam = one('SELECT * FROM exams WHERE id = ?', toId(req.params.id));
  if (!exam) throw new HttpError(404, 'Examen introuvable.');
  const ongoing = one("SELECT id FROM attempts WHERE user_id = ? AND kind = 'examen' AND exam_id = ? AND status = 'en_cours'", req.user.id, exam.id);
  if (ongoing) {
    const a = getAttempt({ params: { id: ongoing.id }, user: req.user });
    if (!maybeAutoSubmitExam(a)) return res.json({ attempt: attemptPayload(getAttempt({ params: { id: ongoing.id }, user: req.user })), resumed: true });
  }
  const ids = generateExamQuestions(parseJson(exam.config, {}));
  if (!ids.length) throw new HttpError(404, 'Pas assez de questions pour générer ce sujet.');
  const deadline = new Date(Date.now() + exam.duration_min * 60_000).toISOString();
  const id = createAttempt(req.user.id, 'examen', ids, { examId: exam.id, title: exam.title, durationMin: exam.duration_min }, { answers: {}, currentIndex: 0, deadline });
  run('UPDATE attempts SET exam_id = ? WHERE id = ?', exam.id, id);
  res.status(201).json({ attempt: attemptPayload(getAttempt({ params: { id }, user: req.user })), resumed: false });
}));

const examAnswersSchema = z.object({
  answers: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.coerce.number()).max(20), z.record(z.coerce.number()), z.null()])),
  currentIndex: z.coerce.number().int().min(0).max(500).optional(),
});

/** Sauvegarde automatique pendant l'examen. */
router.put('/attempts/:id/autosave', handler((req, res) => {
  const a = getAttempt(req, ['examen']);
  if (a.status !== 'en_cours') throw new HttpError(409, 'Cet examen est terminé.');
  if (maybeAutoSubmitExam(a)) throw new HttpError(409, 'Le temps est écoulé : votre copie a été remise automatiquement.');
  const data = validate(examAnswersSchema, req.body);
  const allowed = new Set(a.state.questionIds.map(String));
  const answers = Object.fromEntries(Object.entries(data.answers).filter(([k]) => allowed.has(k)));
  const state = { ...a.state, answers, currentIndex: data.currentIndex ?? a.state.currentIndex };
  run("UPDATE attempts SET state = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", JSON.stringify(state), a.id);
  res.json({ savedAt: new Date().toISOString() });
}));

function submitExam(a, answers, user) {
  const questions = loadQuestions(a.state.questionIds);
  const startedMs = new Date(a.started_at.endsWith('Z') ? a.started_at : a.started_at + 'Z').getTime();
  const deadlineMs = new Date(a.state.deadline).getTime();
  const duration = Math.round((Math.min(Date.now(), deadlineMs) - startedMs) / 1000);
  const perQuestion = questions.length ? duration / questions.length : 0;
  tx(() => {
    for (const q of questions) {
      const ans = answers[q.id] ?? answers[String(q.id)] ?? null;
      const grade = ans === null || ans === '' ? { correct: false, score: 0 } : gradeAnswer(q, ans);
      recordResult({ attemptId: a.id, userId: user.id, question: q, answer: ans, grade, timeSec: perQuestion });
    }
    run('UPDATE attempts SET state = ?, duration_sec = ? WHERE id = ?', JSON.stringify({ ...a.state, answers }), duration, a.id);
  });
  for (const s of getSubjects()) {
    const n = questions.filter((q) => q.subject_id === s.id).length;
    logStudy({ userId: user.id, activity: 'examen', subjectId: s.id, durationSec: perQuestion * n });
  }
  return finishAttempt({ ...a, duration_sec: duration }, user);
}

/** Remet automatiquement la copie si le temps est écoulé (avec 30 s de tolérance réseau). */
function maybeAutoSubmitExam(a) {
  if (a.kind !== 'examen' || a.status !== 'en_cours') return false;
  if (Date.now() <= new Date(a.state.deadline).getTime() + 30_000) return false;
  submitExam(a, a.state.answers || {}, { id: a.user_id });
  return true;
}

router.post('/attempts/:id/submit', handler((req, res) => {
  const a = getAttempt(req, ['examen']);
  if (a.status !== 'en_cours') throw new HttpError(409, 'Cet examen a déjà été remis.');
  const data = validate(examAnswersSchema, req.body);
  const late = Date.now() > new Date(a.state.deadline).getTime() + 30_000;
  const out = submitExam(a, late ? a.state.answers || {} : data.answers, req.user);
  res.json({ summary: summarize(a, out), late });
}));

/** Corrigé détaillé d'un examen terminé. */
router.get('/attempts/:id/review', handler((req, res) => {
  const a = getAttempt(req);
  if (a.status !== 'termine') throw new HttpError(409, 'Le corrigé est disponible une fois la copie remise.');
  const questions = loadQuestions(a.state.questionIds || []);
  const results = all('SELECT * FROM results WHERE attempt_id = ?', a.id);
  const items = questions.map((q) => {
    const r = results.find((x) => x.question_id === q.id);
    const ans = r ? parseJson(r.answer, null) : null;
    return { question: publicQuestion(q), answer: ans, correction: correction(q, ans), unanswered: ans === null || ans === '' };
  });
  res.json({ attempt: { id: a.id, kind: a.kind, score: a.score, percent: a.percent, durationSec: a.duration_sec, finishedAt: a.finished_at, config: a.config }, items });
}));

export default router;
