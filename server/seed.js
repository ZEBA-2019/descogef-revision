/**
 * Initialise la base : contenu de démonstration + compte administrateur.
 *   npm run seed         -> n'insère le contenu que si la base est vide
 *   npm run seed:reset   -> supprime le contenu pédagogique et le recharge (les comptes sont conservés,
 *                           mais leurs tentatives sur l'ancien contenu sont supprimées par cascade)
 */
import { fileURLToPath } from 'node:url';
import { getDb, one, run, tx } from './db.js';
import { hashPassword } from './auth.js';
import { config } from './config.js';
import * as demo from './seed/demo-content.js';

export function seedContent({ reset = false } = {}) {
  const db = getDb();
  const existing = one('SELECT COUNT(*) AS n FROM subjects').n;
  if (existing && !reset) return { seeded: false };

  tx(() => {
    if (reset) {
      for (const t of ['attempts', 'plan_items', 'plans', 'flashcard_states', 'exams', 'subjects']) db.exec(`DELETE FROM ${t}`);
      db.exec("UPDATE users SET diagnostic_done = 0, levels = '{}'");
    }
    const chapterIds = {};
    demo.subjects.forEach((s, si) => {
      const { lastInsertRowid: subjectId } = run(
        'INSERT INTO subjects (code, title, description, position, is_demo) VALUES (?, ?, ?, ?, 1)',
        s.code, s.title, s.description, si
      );
      s.chapters.forEach((c, ci) => {
        const { lastInsertRowid } = run(
          'INSERT INTO chapters (subject_id, title, description, position, is_demo) VALUES (?, ?, ?, ?, 1)',
          subjectId, c.title, c.description, ci
        );
        chapterIds[c.key] = Number(lastInsertRowid);
      });
    });
    const ch = (key) => {
      if (!chapterIds[key]) throw new Error(`Chapitre inconnu dans le contenu de démo : ${key}`);
      return chapterIds[key];
    };

    demo.lessons.forEach((l, i) => run('INSERT INTO lessons (chapter_id, title, content, position) VALUES (?, ?, ?, ?)', ch(l.chapter), l.title, l.content, i));
    demo.sheets.forEach((s, i) =>
      run('INSERT INTO sheets (chapter_id, title, summary, sections, refs, position) VALUES (?, ?, ?, ?, ?, ?)',
        ch(s.chapter), s.title, s.summary, JSON.stringify(s.sections), JSON.stringify(s.refs || []), i)
    );
    demo.questions.forEach((q, i) => {
      const { lastInsertRowid: qid } = run(
        `INSERT INTO questions (chapter_id, type, prompt, difficulty, competency, explanation, answer, is_diagnostic, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ch(q.chapter), q.type, q.prompt, q.difficulty ?? 1, q.competency ?? '', q.explanation ?? '',
        JSON.stringify(q.answer ?? {}), q.diagnostic ? 1 : 0, i
      );
      (q.choices || []).forEach((c, ci) =>
        run('INSERT INTO choices (question_id, label, is_correct, feedback, position) VALUES (?, ?, ?, ?, ?)', qid, c.label, c.correct ? 1 : 0, c.feedback ?? '', ci)
      );
    });
    demo.exercises.forEach((e, i) =>
      run(`INSERT INTO exercises (chapter_id, kind, title, statement, annexes, items, duration_min, difficulty, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ch(e.chapter), e.kind, e.title, e.statement, JSON.stringify(e.annexes), JSON.stringify(e.items), e.duration_min, e.difficulty, i)
    );
    demo.flashcards.forEach((f, i) => run('INSERT INTO flashcards (chapter_id, front, back, position) VALUES (?, ?, ?, ?)', ch(f.chapter), f.front, f.back, i));
    demo.exams.forEach((e) =>
      run('INSERT INTO exams (title, description, duration_min, config) VALUES (?, ?, ?, ?)', e.title, e.description, e.duration_min, JSON.stringify(e.config))
    );
  });
  return { seeded: true };
}

export function ensureAdmin() {
  const existing = one("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing) return { created: false };
  run(
    "INSERT INTO users (email, name, password_hash, role, diagnostic_done) VALUES (?, ?, ?, 'admin', 1)",
    config.adminEmail, 'Administrateur', hashPassword(config.adminPassword)
  );
  return { created: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reset = process.argv.includes('--reset');
  const { seeded } = seedContent({ reset });
  const { created } = ensureAdmin();
  console.log(seeded ? '✔ Contenu de démonstration chargé.' : '• Contenu déjà présent (utilisez --reset pour le recharger).');
  if (created) {
    console.log(`✔ Compte administrateur créé : ${config.adminEmail}`);
    if (!process.env.ADMIN_PASSWORD) console.log('  ⚠ Mot de passe par défaut utilisé : définissez ADMIN_PASSWORD et changez-le après connexion.');
  }
}
