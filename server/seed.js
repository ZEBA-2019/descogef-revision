/**
 * Initialise la base : contenu de démonstration + compte administrateur.
 *   npm run seed         -> n'insère le contenu que si la base est vide (base désignée par DATABASE_URL, sinon PGlite local)
 *   npm run seed:reset   -> supprime le contenu pédagogique et le recharge (les comptes sont conservés,
 *                           mais leurs tentatives sur l'ancien contenu sont supprimées par cascade)
 */
import { fileURLToPath } from 'node:url';
import { one, run, tx, closeDb } from './db.js';
import { hashPassword } from './auth.js';
import { config } from './config.js';
import * as demo from './seed/demo-content.js';

export async function seedContent({ reset = false } = {}) {
  return tx(async () => {
    // Verrou : deux instances serveur démarrant en même temps ne chargent le contenu qu'une fois
    await run('SELECT pg_advisory_xact_lock(4242)');
    const existing = (await one('SELECT COUNT(*) AS n FROM subjects')).n;
    if (existing && !reset) return { seeded: false };
    if (reset) {
      for (const t of ['attempts', 'plan_items', 'plans', 'flashcard_states', 'exams', 'subjects']) await run(`DELETE FROM ${t}`);
      await run("UPDATE users SET diagnostic_done = 0, levels = '{}'");
    }
    const chapterIds = {};
    for (const [si, s] of demo.subjects.entries()) {
      const { lastInsertRowid: subjectId } = await run(
        'INSERT INTO subjects (code, title, description, position, is_demo) VALUES (?, ?, ?, ?, 1) RETURNING id',
        s.code, s.title, s.description, si
      );
      for (const [ci, c] of s.chapters.entries()) {
        const { lastInsertRowid } = await run(
          'INSERT INTO chapters (subject_id, title, description, position, is_demo) VALUES (?, ?, ?, ?, 1) RETURNING id',
          subjectId, c.title, c.description, ci
        );
        chapterIds[c.key] = Number(lastInsertRowid);
      }
    }
    const ch = (key) => {
      if (!chapterIds[key]) throw new Error(`Chapitre inconnu dans le contenu de démo : ${key}`);
      return chapterIds[key];
    };

    for (const [i, l] of demo.lessons.entries()) await run('INSERT INTO lessons (chapter_id, title, content, position) VALUES (?, ?, ?, ?)', ch(l.chapter), l.title, l.content, i);
    for (const [i, s] of demo.sheets.entries()) {
      await run('INSERT INTO sheets (chapter_id, title, summary, sections, refs, position) VALUES (?, ?, ?, ?, ?, ?)',
        ch(s.chapter), s.title, s.summary, JSON.stringify(s.sections), JSON.stringify(s.refs || []), i);
    }
    for (const [i, q] of demo.questions.entries()) {
      const { lastInsertRowid: qid } = await run(
        `INSERT INTO questions (chapter_id, type, prompt, difficulty, competency, explanation, answer, is_diagnostic, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        ch(q.chapter), q.type, q.prompt, q.difficulty ?? 1, q.competency ?? '', q.explanation ?? '',
        JSON.stringify(q.answer ?? {}), q.diagnostic ? 1 : 0, i
      );
      for (const [ci, c] of (q.choices || []).entries()) {
        await run('INSERT INTO choices (question_id, label, is_correct, feedback, position) VALUES (?, ?, ?, ?, ?)', qid, c.label, c.correct ? 1 : 0, c.feedback ?? '', ci);
      }
    }
    for (const [i, e] of demo.exercises.entries()) {
      await run(`INSERT INTO exercises (chapter_id, kind, title, statement, annexes, items, duration_min, difficulty, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ch(e.chapter), e.kind, e.title, e.statement, JSON.stringify(e.annexes), JSON.stringify(e.items), e.duration_min, e.difficulty, i);
    }
    for (const [i, f] of demo.flashcards.entries()) await run('INSERT INTO flashcards (chapter_id, front, back, position) VALUES (?, ?, ?, ?)', ch(f.chapter), f.front, f.back, i);
    for (const e of demo.exams) {
      await run('INSERT INTO exams (title, description, duration_min, config) VALUES (?, ?, ?, ?)', e.title, e.description, e.duration_min, JSON.stringify(e.config));
    }
    return { seeded: true };
  });
}

export async function ensureAdmin() {
  const existing = await one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing) return { created: false };
  await run(
    "INSERT INTO users (email, name, password_hash, role, diagnostic_done) VALUES (?, ?, ?, 'admin', 1) ON CONFLICT (email) DO NOTHING",
    config.adminEmail, 'Administrateur', hashPassword(config.adminPassword)
  );
  return { created: true };
}

/** Initialisation unique par processus : schéma, contenu de démonstration, compte administrateur. */
let initPromise;
export function initDatabase() {
  if (!initPromise) {
    initPromise = (async () => {
      const content = await seedContent();
      const admin = await ensureAdmin();
      return { ...content, ...admin };
    })();
    initPromise.catch(() => (initPromise = undefined));
  }
  return initPromise;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reset = process.argv.includes('--reset');
  const { seeded } = await seedContent({ reset });
  const { created } = await ensureAdmin();
  console.log(seeded ? '✔ Contenu de démonstration chargé.' : '• Contenu déjà présent (utilisez --reset pour le recharger).');
  if (created) {
    console.log(`✔ Compte administrateur créé : ${config.adminEmail}`);
    if (!process.env.ADMIN_PASSWORD) console.log('  ⚠ Mot de passe par défaut utilisé : définissez ADMIN_PASSWORD et changez-le après connexion.');
  }
  await closeDb();
}
