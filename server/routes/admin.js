/**
 * Espace d'administration : création, modification, suppression et classement des contenus.
 * Toutes les routes exigent le rôle « admin ».
 */
import { Router } from 'express';
import { z } from 'zod';
import { all, one, run, tx, parseJson } from '../db.js';
import { handler, validate, HttpError, toId } from '../http.js';
import { requireAdmin } from '../auth.js';

const router = Router();
router.use(requireAdmin);

const text = (label, max = 5000) => z.string({ required_error: `${label} est obligatoire.` }).trim().min(1, `${label} est obligatoire.`).max(max, `${label} est trop long.`);
const optText = (max = 20000) => z.string().max(max).default('');
const fk = (label) => z.coerce.number({ invalid_type_error: `${label} invalide.` }).int().positive(`${label} est obligatoire.`);
const bool = z.coerce.boolean().default(true);

const sectionSchema = z.object({
  kind: z.enum(['definition', 'regle', 'formule', 'methode', 'exemple', 'erreur']),
  title: text('Le titre de section', 200),
  body: text('Le contenu de section', 10000),
});

const annexSchema = z.object({
  title: text('Le titre d’annexe', 300),
  body: z.string().max(20000).optional(),
  table: z.object({ head: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
});

const itemSchema = z.object({
  prompt: text('L’intitulé de la question', 5000),
  hints: z.array(z.string().min(1)).max(10).default([]),
  solution: text('Le corrigé', 20000),
  points: z.coerce.number().min(0).max(100),
  criteria: z.array(z.string()).max(20).default([]),
});

const choiceSchema = z.object({
  label: text('Le libellé du choix', 1000),
  is_correct: z.coerce.boolean().default(false),
  feedback: optText(2000),
});

const questionSchema = z
  .object({
    chapter_id: fk('Le chapitre'),
    type: z.enum(['mcq', 'truefalse', 'short', 'calc', 'match']),
    prompt: text('L’énoncé', 5000),
    difficulty: z.coerce.number().int().min(1).max(3),
    competency: optText(200),
    explanation: optText(5000),
    answer: z.record(z.any()).default({}),
    is_diagnostic: z.coerce.boolean().default(false),
    is_demo: bool,
    choices: z.array(choiceSchema).max(10).default([]),
  })
  .superRefine((q, ctx) => {
    const issue = (message) => ctx.addIssue({ code: 'custom', message, path: ['answer'] });
    if (q.type === 'mcq') {
      if (q.choices.length < 2) ctx.addIssue({ code: 'custom', message: 'Un QCM doit comporter au moins 2 choix.', path: ['choices'] });
      if (!q.choices.some((c) => c.is_correct)) ctx.addIssue({ code: 'custom', message: 'Indiquez au moins une bonne réponse.', path: ['choices'] });
    }
    if (q.type === 'truefalse' && typeof q.answer.value !== 'boolean') issue('Pour un vrai/faux, answer.value doit valoir true ou false.');
    if (q.type === 'short' && (!Array.isArray(q.answer.accepted) || !q.answer.accepted.length)) issue('Indiquez au moins une réponse acceptée (answer.accepted).');
    if (q.type === 'calc' && !Number.isFinite(Number(q.answer.value))) issue('Indiquez la valeur attendue (answer.value).');
    if (q.type === 'match') {
      const { left, right, pairs } = q.answer;
      if (!Array.isArray(left) || !Array.isArray(right) || !Array.isArray(pairs) || !pairs.length) issue('Une association requiert answer.left, answer.right et answer.pairs.');
      else if (pairs.some(([l, r]) => left[l] === undefined || right[r] === undefined)) issue('Une paire fait référence à un élément inexistant.');
    }
  });

/** Configuration des entités administrables. */
const ENTITIES = {
  subjects: {
    table: 'subjects',
    label: 'Matière',
    order: 'position, id',
    schema: z.object({ code: text('Le code', 20), title: text('Le titre', 200), description: optText(2000), is_demo: bool }),
  },
  chapters: {
    table: 'chapters',
    label: 'Chapitre',
    parent: 'subject_id',
    order: 'subject_id, position, id',
    schema: z.object({ subject_id: fk('La matière'), title: text('Le titre', 200), description: optText(2000), is_demo: bool }),
  },
  lessons: {
    table: 'lessons',
    label: 'Leçon',
    parent: 'chapter_id',
    order: 'chapter_id, position, id',
    schema: z.object({ chapter_id: fk('Le chapitre'), title: text('Le titre', 200), content: optText(50000), is_demo: bool }),
  },
  sheets: {
    table: 'sheets',
    label: 'Fiche',
    parent: 'chapter_id',
    order: 'chapter_id, position, id',
    json: ['sections', 'refs'],
    schema: z.object({
      chapter_id: fk('Le chapitre'),
      title: text('Le titre', 200),
      summary: optText(2000),
      sections: z.array(sectionSchema).min(1, 'Ajoutez au moins une section.').max(40),
      refs: z.array(z.string().min(1)).max(30).default([]),
      is_demo: bool,
    }),
  },
  questions: {
    table: 'questions',
    label: 'Question',
    parent: 'chapter_id',
    order: 'chapter_id, position, id',
    json: ['answer'],
    schema: questionSchema,
  },
  exercises: {
    table: 'exercises',
    label: 'Exercice / cas pratique',
    parent: 'chapter_id',
    order: 'chapter_id, position, id',
    json: ['annexes', 'items'],
    schema: z.object({
      chapter_id: fk('Le chapitre'),
      kind: z.enum(['exercice', 'cas']),
      title: text('Le titre', 300),
      statement: text('L’énoncé', 20000),
      annexes: z.array(annexSchema).max(20).default([]),
      items: z.array(itemSchema).min(1, 'Ajoutez au moins une question.').max(30),
      duration_min: z.coerce.number().int().min(5).max(480),
      difficulty: z.coerce.number().int().min(1).max(3),
      is_demo: bool,
    }),
  },
  flashcards: {
    table: 'flashcards',
    label: 'Flashcard',
    parent: 'chapter_id',
    order: 'chapter_id, position, id',
    schema: z.object({ chapter_id: fk('Le chapitre'), front: text('Le recto', 2000), back: text('Le verso', 5000), is_demo: bool }),
  },
  exams: {
    table: 'exams',
    label: 'Examen blanc',
    json: ['config'],
    order: 'id',
    schema: z.object({
      title: text('Le titre', 200),
      description: optText(2000),
      duration_min: z.coerce.number().int().min(5).max(480),
      config: z.object({
        perSubject: z.coerce.number().int().min(1).max(50),
        difficultyMix: z.record(z.enum(['1', '2', '3']), z.coerce.number().int().min(0).max(50)).default({ 1: 2, 2: 1, 3: 1 }),
      }),
      is_demo: bool,
    }),
  },
};

function entity(name) {
  const e = ENTITIES[name];
  if (!e) throw new HttpError(404, 'Type de contenu inconnu.');
  return e;
}

function serialize(e, row) {
  const out = { ...row };
  for (const f of e.json || []) out[f] = parseJson(row[f], null);
  if (e.table === 'questions') out.choices = all('SELECT id, label, is_correct, feedback FROM choices WHERE question_id = ? ORDER BY position, id', row.id);
  return out;
}

function checkParent(e, data) {
  if (e.parent === 'subject_id' && !one('SELECT id FROM subjects WHERE id = ?', data.subject_id)) throw new HttpError(400, 'Matière introuvable.');
  if (e.parent === 'chapter_id' && !one('SELECT id FROM chapters WHERE id = ?', data.chapter_id)) throw new HttpError(400, 'Chapitre introuvable.');
}

function toRow(e, data) {
  const row = { ...data };
  delete row.choices;
  for (const f of e.json || []) row[f] = JSON.stringify(row[f] ?? null);
  for (const k of Object.keys(row)) if (typeof row[k] === 'boolean') row[k] = row[k] ? 1 : 0;
  return row;
}

function saveChoices(questionId, choices) {
  run('DELETE FROM choices WHERE question_id = ?', questionId);
  choices.forEach((c, i) => run('INSERT INTO choices (question_id, label, is_correct, feedback, position) VALUES (?, ?, ?, ?, ?)', questionId, c.label, c.is_correct ? 1 : 0, c.feedback, i));
}

router.get('/overview', handler((_req, res) => {
  const counts = {};
  for (const [k, e] of Object.entries(ENTITIES)) counts[k] = one(`SELECT COUNT(*) AS n FROM ${e.table}`).n;
  counts.users = one('SELECT COUNT(*) AS n FROM users').n;
  counts.demo = Object.values(ENTITIES).reduce((s, e) => s + one(`SELECT COUNT(*) AS n FROM ${e.table} WHERE is_demo = 1`).n, 0);
  res.json({ counts, entities: Object.fromEntries(Object.entries(ENTITIES).map(([k, e]) => [k, { label: e.label, parent: e.parent || null }])) });
}));

router.get('/:entity', handler((req, res) => {
  const e = entity(req.params.entity);
  const where = [];
  const params = [];
  if (e.parent && req.query.parent) { where.push(`${e.parent} = ?`); params.push(toId(req.query.parent)); }
  const rows = all(`SELECT * FROM ${e.table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${e.order}`, ...params);
  res.json({ items: rows.map((r) => serialize(e, r)) });
}));

router.get('/:entity/:id', handler((req, res) => {
  const e = entity(req.params.entity);
  const row = one(`SELECT * FROM ${e.table} WHERE id = ?`, toId(req.params.id));
  if (!row) throw new HttpError(404, `${e.label} introuvable.`);
  res.json({ item: serialize(e, row) });
}));

router.post('/:entity', handler((req, res) => {
  const e = entity(req.params.entity);
  const data = validate(e.schema, req.body);
  checkParent(e, data);
  const id = tx(() => {
    const row = toRow(e, data);
    if (e.table !== 'exams') {
      const parentClause = e.parent ? `WHERE ${e.parent} = ?` : '';
      row.position = (one(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM ${e.table} ${parentClause}`, ...(e.parent ? [data[e.parent]] : [])).p);
    }
    const cols = Object.keys(row);
    const { lastInsertRowid } = run(`INSERT INTO ${e.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...cols.map((c) => row[c]));
    if (e.table === 'questions') saveChoices(Number(lastInsertRowid), data.choices);
    return Number(lastInsertRowid);
  });
  res.status(201).json({ item: serialize(e, one(`SELECT * FROM ${e.table} WHERE id = ?`, id)) });
}));

router.put('/:entity/:id', handler((req, res) => {
  const e = entity(req.params.entity);
  const id = toId(req.params.id);
  if (!one(`SELECT id FROM ${e.table} WHERE id = ?`, id)) throw new HttpError(404, `${e.label} introuvable.`);
  const data = validate(e.schema, req.body);
  checkParent(e, data);
  tx(() => {
    const row = toRow(e, data);
    const cols = Object.keys(row);
    run(`UPDATE ${e.table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...cols.map((c) => row[c]), id);
    if (e.table === 'questions') saveChoices(id, data.choices);
  });
  res.json({ item: serialize(e, one(`SELECT * FROM ${e.table} WHERE id = ?`, id)) });
}));

router.delete('/:entity/:id', handler((req, res) => {
  const e = entity(req.params.entity);
  const id = toId(req.params.id);
  const { changes } = run(`DELETE FROM ${e.table} WHERE id = ?`, id);
  if (!changes) throw new HttpError(404, `${e.label} introuvable.`);
  res.json({ ok: true });
}));

/** Classement : déplace un élément d'un cran vers le haut ou le bas parmi ses frères. */
router.post('/:entity/:id/move', handler((req, res) => {
  const e = entity(req.params.entity);
  if (e.table === 'exams') throw new HttpError(400, 'Les examens ne sont pas classables.');
  const id = toId(req.params.id);
  const { direction } = validate(z.object({ direction: z.enum(['up', 'down']) }), req.body);
  const row = one(`SELECT * FROM ${e.table} WHERE id = ?`, id);
  if (!row) throw new HttpError(404, `${e.label} introuvable.`);
  const siblings = all(`SELECT id FROM ${e.table} ${e.parent ? `WHERE ${e.parent} = ?` : ''} ORDER BY position, id`, ...(e.parent ? [row[e.parent]] : [])).map((r) => r.id);
  const i = siblings.indexOf(id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j >= 0 && j < siblings.length) {
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    tx(() => siblings.forEach((sid, pos) => run(`UPDATE ${e.table} SET position = ? WHERE id = ?`, pos, sid)));
  }
  res.json({ order: siblings });
}));

export default router;
