import { Router } from 'express';
import { z } from 'zod';
import { all, one, run, parseJson } from '../db.js';
import { handler, validate, HttpError, toId } from '../http.js';
import { requireAuth } from '../auth.js';
import { schedule, buildQueue } from '../../shared/srs.js';
import { getProgramTree, logStudy, userProgress } from '../services.js';
import { DEMO_NOTICE } from '../seed/demo-content.js';

const router = Router();
router.use(requireAuth);

/* ------------------------------ Programme ------------------------------ */

router.get('/program', handler((req, res) => {
  const tree = getProgramTree();
  const progress = userProgress(req.user.id);
  const byChapter = new Map(progress.chapters.map((c) => [c.chapterId, c]));
  res.json({
    demoNotice: tree.some((s) => s.is_demo) ? DEMO_NOTICE : null,
    subjects: tree.map((s) => ({
      ...s,
      progress: progress.subjects.find((p) => p.subjectId === s.id)?.progress ?? 0,
      chapters: s.chapters.map((c) => ({ ...c, progress: byChapter.get(c.id)?.progress ?? 0, mastery: byChapter.get(c.id)?.mastery ?? 0, answered: byChapter.get(c.id)?.count ?? 0 })),
    })),
  });
}));

router.get('/chapters/:id', handler((req, res) => {
  const chapter = one('SELECT c.*, s.title AS subject_title, s.id AS subject_id FROM chapters c JOIN subjects s ON s.id = c.subject_id WHERE c.id = ?', toId(req.params.id));
  if (!chapter) throw new HttpError(404, 'Chapitre introuvable.');
  res.json({
    chapter,
    lessons: all('SELECT * FROM lessons WHERE chapter_id = ? ORDER BY position, id', chapter.id),
    sheets: all('SELECT id, title, summary FROM sheets WHERE chapter_id = ? ORDER BY position, id', chapter.id),
    exercises: all('SELECT id, kind, title, duration_min, difficulty FROM exercises WHERE chapter_id = ? ORDER BY position, id', chapter.id),
    counts: one(
      `SELECT (SELECT COUNT(*) FROM questions WHERE chapter_id = ?) AS questions,
              (SELECT COUNT(*) FROM flashcards WHERE chapter_id = ?) AS flashcards`,
      chapter.id, chapter.id
    ),
  });
}));

/* ------------------------------ Fiches ------------------------------ */

router.get('/sheets', handler((req, res) => {
  const rows = all(
    `SELECT sh.id, sh.title, sh.summary, sh.chapter_id, sh.is_demo, c.title AS chapter_title, s.id AS subject_id, s.title AS subject_title,
            COALESCE(ss.status, 'a_decouvrir') AS status,
            CASE WHEN f.sheet_id IS NULL THEN 0 ELSE 1 END AS favorite
     FROM sheets sh JOIN chapters c ON c.id = sh.chapter_id JOIN subjects s ON s.id = c.subject_id
     LEFT JOIN sheet_status ss ON ss.sheet_id = sh.id AND ss.user_id = ?
     LEFT JOIN favorites f ON f.sheet_id = sh.id AND f.user_id = ?
     ORDER BY s.position, c.position, sh.position`,
    req.user.id, req.user.id
  );
  res.json({ sheets: rows });
}));

router.get('/sheets/:id', handler((req, res) => {
  const sheet = one(
    `SELECT sh.*, c.title AS chapter_title, s.id AS subject_id, s.title AS subject_title
     FROM sheets sh JOIN chapters c ON c.id = sh.chapter_id JOIN subjects s ON s.id = c.subject_id WHERE sh.id = ?`,
    toId(req.params.id)
  );
  if (!sheet) throw new HttpError(404, 'Fiche introuvable.');
  const uid = req.user.id;
  res.json({
    sheet: { ...sheet, sections: parseJson(sheet.sections, []), refs: parseJson(sheet.refs, []) },
    status: one('SELECT status FROM sheet_status WHERE user_id = ? AND sheet_id = ?', uid, sheet.id)?.status ?? 'a_decouvrir',
    favorite: Boolean(one('SELECT 1 AS x FROM favorites WHERE user_id = ? AND sheet_id = ?', uid, sheet.id)),
    note: one('SELECT content, updated_at FROM notes WHERE user_id = ? AND sheet_id = ?', uid, sheet.id) ?? { content: '', updated_at: null },
    demoNotice: sheet.is_demo ? DEMO_NOTICE : null,
  });
}));

function ensureSheet(id) {
  if (!one('SELECT id FROM sheets WHERE id = ?', id)) throw new HttpError(404, 'Fiche introuvable.');
}

router.put('/sheets/:id/status', handler((req, res) => {
  const sheetId = toId(req.params.id);
  ensureSheet(sheetId);
  const { status } = validate(z.object({ status: z.enum(['a_decouvrir', 'en_cours', 'maitrise'], { errorMap: () => ({ message: 'Statut invalide.' }) }) }), req.body);
  run(
    `INSERT INTO sheet_status (user_id, sheet_id, status) VALUES (?, ?, ?)
     ON CONFLICT (user_id, sheet_id) DO UPDATE SET status = excluded.status, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    req.user.id, sheetId, status
  );
  res.json({ status });
}));

router.put('/sheets/:id/favorite', handler((req, res) => {
  const sheetId = toId(req.params.id);
  ensureSheet(sheetId);
  const { favorite } = validate(z.object({ favorite: z.boolean() }), req.body);
  if (favorite) run('INSERT OR IGNORE INTO favorites (user_id, sheet_id) VALUES (?, ?)', req.user.id, sheetId);
  else run('DELETE FROM favorites WHERE user_id = ? AND sheet_id = ?', req.user.id, sheetId);
  res.json({ favorite });
}));

router.put('/sheets/:id/note', handler((req, res) => {
  const sheetId = toId(req.params.id);
  ensureSheet(sheetId);
  const { content } = validate(z.object({ content: z.string().max(10_000, 'La note est limitée à 10 000 caractères.') }), req.body);
  run(
    `INSERT INTO notes (user_id, sheet_id, content) VALUES (?, ?, ?)
     ON CONFLICT (user_id, sheet_id) DO UPDATE SET content = excluded.content, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    req.user.id, sheetId, content
  );
  res.json({ savedAt: new Date().toISOString() });
}));

/* ------------------------------ Temps de révision ------------------------------ */

router.post('/study-sessions', handler((req, res) => {
  const data = validate(
    z.object({
      activity: z.enum(['fiche', 'flashcards', 'cas', 'lecture']),
      subjectId: z.coerce.number().int().positive().nullable().optional(),
      chapterId: z.coerce.number().int().positive().nullable().optional(),
      durationSec: z.coerce.number().int().min(1).max(4 * 3600),
    }),
    req.body
  );
  logStudy({ userId: req.user.id, ...data });
  res.status(201).json({ ok: true });
}));

/* ------------------------------ Flashcards ------------------------------ */

router.get('/flashcards/queue', handler((req, res) => {
  const { subjectId, chapterId, limit } = validate(
    z.object({ subjectId: z.coerce.number().int().positive().optional(), chapterId: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }),
    req.query
  );
  const where = [];
  const params = [req.user.id];
  if (chapterId) { where.push('f.chapter_id = ?'); params.push(chapterId); }
  else if (subjectId) { where.push('c.subject_id = ?'); params.push(subjectId); }
  const cards = all(
    `SELECT f.id, f.front, f.back, f.chapter_id, c.title AS chapter_title, s.title AS subject_title,
            st.ease, st.interval, st.repetitions, st.lapses, st.last_grade, st.due_at
     FROM flashcards f JOIN chapters c ON c.id = f.chapter_id JOIN subjects s ON s.id = c.subject_id
     LEFT JOIN flashcard_states st ON st.flashcard_id = f.id AND st.user_id = ?
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.position, c.position, f.position`,
    ...params
  );
  const now = new Date();
  const queue = buildQueue(cards, { now, limit });
  const nextDue = cards.filter((c) => c.due_at && new Date(c.due_at) > now).sort((a, b) => a.due_at.localeCompare(b.due_at))[0]?.due_at ?? null;
  res.json({
    queue,
    totals: {
      total: cards.length,
      due: cards.filter((c) => c.due_at && new Date(c.due_at) <= now).length,
      fresh: cards.filter((c) => !c.due_at).length,
      learned: cards.filter((c) => c.repetitions >= 2).length,
    },
    nextDue,
  });
}));

router.post('/flashcards/:id/review', handler((req, res) => {
  const cardId = toId(req.params.id);
  const card = one('SELECT f.id, c.subject_id, f.chapter_id FROM flashcards f JOIN chapters c ON c.id = f.chapter_id WHERE f.id = ?', cardId);
  if (!card) throw new HttpError(404, 'Carte introuvable.');
  const { grade, timeSec } = validate(z.object({ grade: z.number().int().min(0).max(3), timeSec: z.coerce.number().min(0).max(600).default(0) }), req.body);
  const current = one('SELECT * FROM flashcard_states WHERE user_id = ? AND flashcard_id = ?', req.user.id, cardId);
  const next = schedule(current, grade);
  run(
    `INSERT INTO flashcard_states (user_id, flashcard_id, ease, interval, repetitions, lapses, last_grade, due_at, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT (user_id, flashcard_id) DO UPDATE SET ease = excluded.ease, interval = excluded.interval,
       repetitions = excluded.repetitions, lapses = excluded.lapses, last_grade = excluded.last_grade,
       due_at = excluded.due_at, reviewed_at = excluded.reviewed_at`,
    req.user.id, cardId, next.ease, next.interval, next.repetitions, next.lapses, next.last_grade, next.due_at
  );
  logStudy({ userId: req.user.id, activity: 'flashcards', subjectId: card.subject_id, chapterId: card.chapter_id, durationSec: timeSec });
  res.json({ state: next });
}));

/* ------------------------------ Exercices et cas pratiques ------------------------------ */

router.get('/exercises', handler((req, res) => {
  const rows = all(
    `SELECT x.id, x.kind, x.title, x.duration_min, x.difficulty, x.is_demo, c.title AS chapter_title, s.title AS subject_title,
       (SELECT MAX(a.percent) FROM attempts a WHERE a.exercise_id = x.id AND a.user_id = ? AND a.status = 'termine') AS best_percent,
       (SELECT COUNT(*) FROM attempts a WHERE a.exercise_id = x.id AND a.user_id = ? AND a.status = 'termine') AS attempts_count
     FROM exercises x JOIN chapters c ON c.id = x.chapter_id JOIN subjects s ON s.id = c.subject_id
     ORDER BY s.position, c.position, x.position`,
    req.user.id, req.user.id
  );
  res.json({ exercises: rows });
}));

/** Énoncé sans corrigé ; les indices et la solution sont révélés à la demande. */
router.get('/exercises/:id', handler((req, res) => {
  const x = one(
    `SELECT x.*, c.title AS chapter_title, s.title AS subject_title, s.id AS subject_id
     FROM exercises x JOIN chapters c ON c.id = x.chapter_id JOIN subjects s ON s.id = c.subject_id WHERE x.id = ?`,
    toId(req.params.id)
  );
  if (!x) throw new HttpError(404, 'Cas pratique introuvable.');
  const items = parseJson(x.items, []);
  res.json({
    exercise: {
      ...x,
      annexes: parseJson(x.annexes, []),
      items: items.map((it, i) => ({ index: i, prompt: it.prompt, points: it.points, hintsCount: (it.hints || []).length })),
      totalPoints: items.reduce((s, it) => s + (it.points || 0), 0),
    },
    demoNotice: x.is_demo ? DEMO_NOTICE : null,
  });
}));

router.get('/exercises/:id/items/:index/hint/:n', handler((req, res) => {
  const x = one('SELECT items FROM exercises WHERE id = ?', toId(req.params.id));
  if (!x) throw new HttpError(404, 'Cas pratique introuvable.');
  const item = parseJson(x.items, [])[Number(req.params.index)];
  const hint = item?.hints?.[Number(req.params.n)];
  if (!hint) throw new HttpError(404, 'Pas d’indice supplémentaire.');
  res.json({ hint });
}));

router.get('/exercises/:id/items/:index/solution', handler((req, res) => {
  const x = one('SELECT items FROM exercises WHERE id = ?', toId(req.params.id));
  if (!x) throw new HttpError(404, 'Cas pratique introuvable.');
  const item = parseJson(x.items, [])[Number(req.params.index)];
  if (!item) throw new HttpError(404, 'Question introuvable.');
  res.json({ solution: item.solution, criteria: item.criteria || [], points: item.points });
}));

/** Enregistre une tentative de cas pratique avec l'autoévaluation (points attribués par question). */
router.post('/exercises/:id/attempts', handler((req, res) => {
  const x = one('SELECT x.*, c.subject_id FROM exercises x JOIN chapters c ON c.id = x.chapter_id WHERE x.id = ?', toId(req.params.id));
  if (!x) throw new HttpError(404, 'Cas pratique introuvable.');
  const items = parseJson(x.items, []);
  const data = validate(
    z.object({
      answers: z.array(z.string().max(20_000)).max(50),
      selfScores: z.array(z.number().min(0)).max(50),
      hintsUsed: z.array(z.number().int().min(0)).max(50).default([]),
      durationSec: z.coerce.number().int().min(0).max(8 * 3600),
      timed: z.boolean().default(false),
    }),
    req.body
  );
  if (data.selfScores.length !== items.length) throw new HttpError(400, 'Évaluez chaque question avant de valider.');
  data.selfScores.forEach((s, i) => {
    if (s > (items[i].points || 0)) throw new HttpError(400, `La note de la question ${i + 1} dépasse le barème.`);
  });
  const total = items.reduce((s, it) => s + (it.points || 0), 0);
  const got = data.selfScores.reduce((s, v) => s + v, 0);
  const percent = total ? Math.round((got / total) * 1000) / 10 : 0;
  const { lastInsertRowid } = run(
    `INSERT INTO attempts (user_id, kind, status, exercise_id, config, state, finished_at, duration_sec, score, percent)
     VALUES (?, 'cas', 'termine', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ?, ?, ?)`,
    req.user.id, x.id, JSON.stringify({ timed: data.timed, title: x.title }), JSON.stringify({ answers: data.answers, selfScores: data.selfScores, hintsUsed: data.hintsUsed }),
    data.durationSec, total ? Math.round((got / total) * 2000) / 100 : 0, percent
  );
  items.forEach((it, i) =>
    run(
      `INSERT INTO results (attempt_id, user_id, exercise_id, item_index, subject_id, chapter_id, difficulty, competency, answer, is_correct, score, time_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      lastInsertRowid, req.user.id, x.id, i, x.subject_id, x.chapter_id, x.difficulty, 'Cas pratique',
      JSON.stringify(data.answers[i] ?? ''), data.selfScores[i] >= it.points ? 1 : 0, it.points ? data.selfScores[i] / it.points : 0,
      Math.round(data.durationSec / items.length)
    )
  );
  logStudy({ userId: req.user.id, activity: 'cas', subjectId: x.subject_id, chapterId: x.chapter_id, durationSec: data.durationSec });
  res.status(201).json({ attemptId: Number(lastInsertRowid), points: got, total, percent, outOf20: total ? Math.round((got / total) * 2000) / 100 : 0 });
}));

export default router;
