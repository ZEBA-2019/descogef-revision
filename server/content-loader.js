/**
 * Chargement de contenu pédagogique (démonstration ou import d'un référentiel réel).
 *
 * Format (voir docs/import-format.md et docs/modele-import.json) :
 * {
 *   subjects:   [{ code, title, description?, chapters: [{ key, title, description? }] }],
 *   lessons?:   [{ chapter, title, content }],
 *   sheets?:    [{ chapter, title, summary?, sections: [{ kind, title, body }], refs? }],
 *   questions?: [{ chapter, type, prompt, difficulty?, competency?, explanation?, answer?, choices?, diagnostic? }],
 *   exercises?: [{ chapter, kind?, title, statement, annexes?, items: [...], duration_min?, difficulty? }],
 *   flashcards?:[{ chapter, front, back }],
 *   exams?:     [{ title, description?, duration_min, config: { perSubject, difficultyMix? } }]
 * }
 * `chapter` renvoie à la clé `key` d'un chapitre déclaré dans `subjects`.
 */
import { z } from 'zod';
import { one, run } from './db.js';

const str = (label, max = 20000) =>
  z.string({ required_error: `${label} : champ obligatoire.`, invalid_type_error: `${label} : texte attendu.` }).trim().min(1, `${label} : champ vide.`).max(max, `${label} : texte trop long.`);
const opt = (max = 20000) => z.string().max(max).optional().default('');

const choiceSchema = z.object({ label: str('Choix'), correct: z.boolean().optional().default(false), feedback: opt(2000) });

const questionSchema = z
  .object({
    chapter: str('Chapitre de la question', 100),
    type: z.enum(['mcq', 'truefalse', 'short', 'calc', 'match'], { errorMap: () => ({ message: 'Type de question : mcq, truefalse, short, calc ou match.' }) }),
    prompt: str('Énoncé', 5000),
    difficulty: z.number().int().min(1).max(3).optional().default(1),
    competency: opt(200),
    explanation: opt(5000),
    answer: z.record(z.any()).optional().default({}),
    choices: z.array(choiceSchema).max(10).optional().default([]),
    diagnostic: z.boolean().optional().default(false),
  })
  .superRefine((q, ctx) => {
    const bad = (message) => ctx.addIssue({ code: 'custom', message });
    const a = q.answer;
    if (q.type === 'mcq') {
      if (q.choices.length < 2) bad('QCM : au moins 2 choix.');
      if (!q.choices.some((c) => c.correct)) bad('QCM : au moins une bonne réponse (correct: true).');
    }
    if (q.type === 'truefalse' && typeof a.value !== 'boolean') bad('Vrai/faux : answer.value doit valoir true ou false.');
    if (q.type === 'short' && !(Array.isArray(a.accepted) && a.accepted.length)) bad('Réponse courte : answer.accepted doit lister au moins une réponse.');
    if (q.type === 'calc' && !Number.isFinite(Number(a.value))) bad('Calcul : answer.value doit être un nombre.');
    if (q.type === 'match') {
      const ok = Array.isArray(a.left) && Array.isArray(a.right) && Array.isArray(a.pairs) && a.pairs.length > 0
        && a.pairs.every((p) => Array.isArray(p) && a.left[p[0]] !== undefined && a.right[p[1]] !== undefined);
      if (!ok) bad('Association : answer.left, answer.right et answer.pairs ([[gauche, droite], …]) cohérents requis.');
    }
  });

export const contentSchema = z.object({
  subjects: z
    .array(
      z.object({
        code: str('Code de matière', 20),
        title: str('Intitulé de matière', 200),
        description: opt(2000),
        chapters: z.array(z.object({ key: str('Clé de chapitre', 100), title: str('Intitulé de chapitre', 200), description: opt(2000) })).min(1, 'Chaque matière doit avoir au moins un chapitre.'),
      })
    )
    .min(1, 'Le fichier doit contenir au moins une matière.'),
  lessons: z.array(z.object({ chapter: str('Chapitre de la leçon', 100), title: str('Titre de leçon', 200), content: opt(50000) })).optional().default([]),
  sheets: z
    .array(
      z.object({
        chapter: str('Chapitre de la fiche', 100),
        title: str('Titre de fiche', 200),
        summary: opt(2000),
        sections: z.array(z.object({ kind: z.enum(['definition', 'regle', 'formule', 'methode', 'exemple', 'erreur']), title: str('Titre de section', 200), body: str('Contenu de section', 10000) })).min(1),
        refs: z.array(z.string().min(1)).optional().default([]),
      })
    )
    .optional()
    .default([]),
  questions: z.array(questionSchema).optional().default([]),
  exercises: z
    .array(
      z.object({
        chapter: str("Chapitre de l'exercice", 100),
        kind: z.enum(['exercice', 'cas']).optional().default('cas'),
        title: str("Titre de l'exercice", 300),
        statement: str('Énoncé', 20000),
        annexes: z.array(z.object({ title: str("Titre d'annexe", 300), body: z.string().optional(), table: z.object({ head: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional() })).optional().default([]),
        items: z.array(z.object({ prompt: str('Question', 5000), hints: z.array(z.string()).optional().default([]), solution: str('Corrigé', 20000), points: z.number().min(0).max(100), criteria: z.array(z.string()).optional().default([]) })).min(1),
        duration_min: z.number().int().min(5).max(480).optional().default(60),
        difficulty: z.number().int().min(1).max(3).optional().default(2),
      })
    )
    .optional()
    .default([]),
  flashcards: z.array(z.object({ chapter: str('Chapitre de la flashcard', 100), front: str('Recto', 2000), back: str('Verso', 5000) })).optional().default([]),
  exams: z
    .array(
      z.object({
        title: str("Titre d'examen", 200),
        description: opt(2000),
        duration_min: z.number().int().min(5).max(480),
        config: z.object({ perSubject: z.number().int().min(1).max(50), difficultyMix: z.record(z.number().int().min(0)).optional() }),
      })
    )
    .optional()
    .default([]),
});

/**
 * Valide un contenu et vérifie les références aux chapitres.
 * @returns {{ ok: true, content } | { ok: false, errors: string[] }}
 */
export function validateContent(raw) {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 30).map((i) => `${i.path.join('.') || 'racine'} : ${i.message}`) };
  }
  const content = parsed.data;
  const errors = [];
  const keys = new Set();
  const codes = new Set();
  for (const s of content.subjects) {
    if (codes.has(s.code)) errors.push(`Code de matière en double : ${s.code}`);
    codes.add(s.code);
    for (const c of s.chapters) {
      if (keys.has(c.key)) errors.push(`Clé de chapitre en double : ${c.key}`);
      keys.add(c.key);
    }
  }
  for (const kind of ['lessons', 'sheets', 'questions', 'exercises', 'flashcards']) {
    content[kind].forEach((item, i) => {
      if (!keys.has(item.chapter)) errors.push(`${kind}.${i} : chapitre « ${item.chapter} » inconnu (clés déclarées : ${[...keys].join(', ')}).`);
    });
  }
  return errors.length ? { ok: false, errors: errors.slice(0, 30) } : { ok: true, content };
}

/** Résumé chiffré d'un contenu validé. */
export function summarizeContent(c) {
  return {
    matieres: c.subjects.length,
    chapitres: c.subjects.reduce((n, s) => n + s.chapters.length, 0),
    lecons: c.lessons.length,
    fiches: c.sheets.length,
    questions: c.questions.length,
    questionsDiagnostic: c.questions.filter((q) => q.diagnostic).length,
    casPratiques: c.exercises.length,
    flashcards: c.flashcards.length,
    examens: c.exams.length,
  };
}

/** Supprime tout le contenu pédagogique et la progression qui en dépend (les comptes sont conservés). */
export async function clearContent() {
  for (const t of ['attempts', 'plan_items', 'plans', 'flashcard_states', 'exams', 'subjects']) await run(`DELETE FROM ${t}`);
  await run("UPDATE users SET diagnostic_done = 0, levels = '{}'");
}

/**
 * Insère un contenu validé. À appeler dans une transaction.
 * Une matière dont le code existe déjà est complétée (ses nouveaux chapitres sont ajoutés à la suite).
 */
export async function insertContent(content, { isDemo = false } = {}) {
  const demo = isDemo ? 1 : 0;
  const chapterIds = {};
  const nextPos = async (table, col, id) => (await one(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM ${table} WHERE ${col} = ?`, id)).p;

  for (const s of content.subjects) {
    let subject = await one('SELECT id FROM subjects WHERE code = ?', s.code);
    if (!subject) {
      const pos = (await one('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM subjects')).p;
      const { lastInsertRowid } = await run(
        'INSERT INTO subjects (code, title, description, position, is_demo) VALUES (?, ?, ?, ?, ?) RETURNING id',
        s.code, s.title, s.description, pos, demo
      );
      subject = { id: Number(lastInsertRowid) };
    }
    let pos = await nextPos('chapters', 'subject_id', subject.id);
    for (const c of s.chapters) {
      const { lastInsertRowid } = await run(
        'INSERT INTO chapters (subject_id, title, description, position, is_demo) VALUES (?, ?, ?, ?, ?) RETURNING id',
        subject.id, c.title, c.description, pos++, demo
      );
      chapterIds[c.key] = Number(lastInsertRowid);
    }
  }
  const ch = (key) => {
    if (!chapterIds[key]) throw new Error(`Chapitre inconnu : ${key}`);
    return chapterIds[key];
  };

  for (const [i, l] of content.lessons.entries()) {
    await run('INSERT INTO lessons (chapter_id, title, content, position, is_demo) VALUES (?, ?, ?, ?, ?)', ch(l.chapter), l.title, l.content, i, demo);
  }
  for (const [i, s] of content.sheets.entries()) {
    await run('INSERT INTO sheets (chapter_id, title, summary, sections, refs, position, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ch(s.chapter), s.title, s.summary, JSON.stringify(s.sections), JSON.stringify(s.refs || []), i, demo);
  }
  for (const [i, q] of content.questions.entries()) {
    const { lastInsertRowid: qid } = await run(
      `INSERT INTO questions (chapter_id, type, prompt, difficulty, competency, explanation, answer, is_diagnostic, position, is_demo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      ch(q.chapter), q.type, q.prompt, q.difficulty ?? 1, q.competency ?? '', q.explanation ?? '',
      JSON.stringify(q.answer ?? {}), q.diagnostic ? 1 : 0, i, demo
    );
    for (const [ci, c] of (q.choices || []).entries()) {
      await run('INSERT INTO choices (question_id, label, is_correct, feedback, position) VALUES (?, ?, ?, ?, ?)', qid, c.label, c.correct ? 1 : 0, c.feedback ?? '', ci);
    }
  }
  for (const [i, e] of content.exercises.entries()) {
    await run(`INSERT INTO exercises (chapter_id, kind, title, statement, annexes, items, duration_min, difficulty, position, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ch(e.chapter), e.kind ?? 'cas', e.title, e.statement, JSON.stringify(e.annexes ?? []), JSON.stringify(e.items), e.duration_min ?? 60, e.difficulty ?? 2, i, demo);
  }
  for (const [i, f] of content.flashcards.entries()) {
    await run('INSERT INTO flashcards (chapter_id, front, back, position, is_demo) VALUES (?, ?, ?, ?, ?)', ch(f.chapter), f.front, f.back, i, demo);
  }
  for (const e of content.exams) {
    await run('INSERT INTO exams (title, description, duration_min, config, is_demo) VALUES (?, ?, ?, ?, ?)',
      e.title, e.description ?? '', e.duration_min, JSON.stringify({ difficultyMix: { 1: 2, 2: 1, 3: 1 }, ...e.config }), demo);
  }
}
