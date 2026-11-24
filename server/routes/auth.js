import { Router } from 'express';
import { z } from 'zod';
import { all, one, run, tx } from '../db.js';
import { handler, validate, HttpError } from '../http.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, setSessionCookie,
  publicUser, requireAuth, rateLimit, COOKIE_NAME,
} from '../auth.js';

const router = Router();

const passwordSchema = z
  .string({ required_error: 'Le mot de passe est obligatoire.' })
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(128, 'Le mot de passe est trop long.')
  .regex(/[A-Za-z]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.');

const emailSchema = z.string({ required_error: 'L’adresse e-mail est obligatoire.' }).trim().toLowerCase().email('Adresse e-mail invalide.').max(200);

const registerSchema = z.object({
  name: z.string({ required_error: 'Le nom est obligatoire.' }).trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(80, 'Le nom est trop long.'),
  email: emailSchema,
  password: passwordSchema,
});

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30, key: 'auth' });

router.post('/register', authLimiter, handler(async (req, res) => {
  const data = validate(registerSchema, req.body);
  if (await one('SELECT id FROM users WHERE email = ?', data.email)) {
    throw new HttpError(409, 'Un compte existe déjà avec cette adresse e-mail.');
  }
  const { lastInsertRowid } = await run('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id', data.email, data.name, hashPassword(data.password));
  const { token, expires } = await createSession(Number(lastInsertRowid));
  setSessionCookie(res, token, expires);
  res.status(201).json({ user: publicUser(await one('SELECT * FROM users WHERE id = ?', lastInsertRowid)) });
}));

router.post('/login', authLimiter, handler(async (req, res) => {
  const data = validate(z.object({ email: emailSchema, password: z.string().min(1, 'Le mot de passe est obligatoire.') }), req.body);
  const user = await one('SELECT * FROM users WHERE email = ?', data.email);
  if (!user || !verifyPassword(data.password, user.password_hash)) {
    throw new HttpError(401, 'Adresse e-mail ou mot de passe incorrect.');
  }
  const { token, expires } = await createSession(user.id);
  setSessionCookie(res, token, expires);
  res.json({ user: publicUser(user) });
}));

router.post('/logout', handler(async (req, res) => {
  await destroySession(req.sessionToken);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}));

router.get('/me', handler(async (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
}));

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(80).optional(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date d’examen invalide.').nullable().optional(),
  settings: z
    .object({
      theme: z.enum(['clair', 'sombre', 'systeme']).optional(),
      dailyGoalMin: z.number().int().min(10).max(600).optional(),
      showTimer: z.boolean().optional(),
    })
    .optional(),
});

router.patch('/profile', requireAuth, handler(async (req, res) => {
  const data = validate(profileSchema, req.body);
  const u = req.user;
  const settings = { ...JSON.parse(u.settings || '{}'), ...(data.settings || {}) };
  await run('UPDATE users SET name = ?, exam_date = ?, settings = ? WHERE id = ?',
    data.name ?? u.name, data.examDate === undefined ? u.exam_date : data.examDate, JSON.stringify(settings), u.id);
  res.json({ user: publicUser(await one('SELECT * FROM users WHERE id = ?', u.id)) });
}));

router.post('/password', requireAuth, authLimiter, handler(async (req, res) => {
  const data = validate(z.object({ current: z.string().min(1, 'Saisissez votre mot de passe actuel.'), next: passwordSchema }), req.body);
  if (!verifyPassword(data.current, req.user.password_hash)) throw new HttpError(400, 'Le mot de passe actuel est incorrect.');
  await run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(data.next), req.user.id);
  await run('DELETE FROM auth_sessions WHERE user_id = ?', req.user.id);
  const { token, expires } = await createSession(req.user.id);
  setSessionCookie(res, token, expires);
  res.json({ ok: true });
}));

/** Réinitialise toute la progression (tentatives, flashcards, planning, statuts). */
router.post('/reset-progress', requireAuth, handler(async (req, res) => {
  validate(z.object({ confirm: z.literal('REINITIALISER', { errorMap: () => ({ message: 'Confirmation requise.' }) }) }), req.body);
  const uid = req.user.id;
  await tx(async () => {
    for (const t of ['attempts', 'results', 'study_sessions', 'flashcard_states', 'plans', 'plan_items', 'notes', 'favorites', 'sheet_status']) {
      await run(`DELETE FROM ${t} WHERE user_id = ?`, uid);
    }
    await run("UPDATE users SET diagnostic_done = 0, levels = '{}' WHERE id = ?", uid);
  });
  res.json({ ok: true });
}));

/** Export des données personnelles (portabilité). */
router.get('/export', requireAuth, handler(async (req, res) => {
  const uid = req.user.id;
  const tables = ['attempts', 'results', 'study_sessions', 'flashcard_states', 'plans', 'plan_items', 'notes', 'favorites', 'sheet_status'];
  const data = { exportedAt: new Date().toISOString(), user: publicUser(req.user) };
  for (const t of tables) data[t] = await all(`SELECT * FROM ${t} WHERE user_id = ?`, uid);
  res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees-descogef.json"');
  res.json(data);
}));

export default router;
