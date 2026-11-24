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
import { validateContent, insertContent, clearContent } from './content-loader.js';

export async function seedContent({ reset = false } = {}) {
  return tx(async () => {
    // Verrou : deux instances serveur démarrant en même temps ne chargent le contenu qu'une fois
    await run('SELECT pg_advisory_xact_lock(4242)');
    const existing = (await one('SELECT COUNT(*) AS n FROM subjects')).n;
    if (existing && !reset) return { seeded: false };
    if (reset) await clearContent();
    const { ok, content, errors } = validateContent({
      subjects: demo.subjects, lessons: demo.lessons, sheets: demo.sheets, questions: demo.questions,
      exercises: demo.exercises, flashcards: demo.flashcards, exams: demo.exams,
    });
    if (!ok) throw new Error(`Contenu de démonstration invalide : ${errors.join(' | ')}`);
    await insertContent(content, { isDemo: true });
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
