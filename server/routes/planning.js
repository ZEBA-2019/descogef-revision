import { Router } from 'express';
import { z } from 'zod';
import { one, run, tx, parseJson, all } from '../db.js';
import { handler, validate, HttpError, toId } from '../http.js';
import { requireAuth } from '../auth.js';
import { generatePlan, rescheduleMissed, toISODate, addDays } from '../../shared/planner.js';
import { getProgramTree, planItems, todayISO, dashboard, stats } from '../services.js';

const router = Router();
router.use(requireAuth);

/* ------------------------------ Tableau de bord & statistiques ------------------------------ */

router.get('/dashboard', handler((req, res) => res.json(dashboard(req.user))));
router.get('/stats', handler((req, res) => res.json(stats(req.user))));

/* ------------------------------ Planning ------------------------------ */

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (format AAAA-MM-JJ).');

/** Replanifie les séances manquées (appelé à chaque consultation du planning). */
function autoReschedule(userId, plan) {
  const items = all("SELECT * FROM plan_items WHERE user_id = ? AND status IN ('prevu', 'fait')", userId);
  const { missed, rescheduled } = rescheduleMissed({
    items,
    today: new Date(),
    examDate: plan.exam_date,
    availability: parseJson(plan.availability, {}),
  });
  if (!missed.length) return 0;
  tx(() => {
    for (const m of missed) run("UPDATE plan_items SET status = 'manque' WHERE id = ?", m.id);
    for (const r of rescheduled) {
      run(
        'INSERT INTO plan_items (plan_id, user_id, date, subject_id, chapter_id, activity, duration_min, status, rescheduled_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        plan.id, userId, r.date, r.subject_id, r.chapter_id, r.activity, r.duration_min, 'prevu', r.rescheduled_from
      );
    }
  });
  return rescheduled.length;
}

router.get('/planning', handler((req, res) => {
  const plan = one('SELECT * FROM plans WHERE user_id = ?', req.user.id);
  if (!plan) return res.json({ plan: null, items: [] });
  const q = validate(z.object({ from: dateStr.optional(), to: dateStr.optional() }), req.query);
  const rescheduled = autoReschedule(req.user.id, plan);
  const from = q.from || todayISO();
  const to = q.to || toISODate(addDays(new Date(), 6));
  const totals = one(
    `SELECT COUNT(*) AS total, SUM(status = 'fait') AS done, SUM(status = 'manque') AS missed, SUM(CASE WHEN status = 'fait' THEN duration_min ELSE 0 END) AS done_min
     FROM plan_items WHERE user_id = ?`,
    req.user.id
  );
  res.json({
    plan: { ...plan, availability: parseJson(plan.availability, {}), levels: parseJson(plan.levels, {}) },
    items: planItems(req.user.id, from, to),
    totals,
    rescheduled,
  });
}));

const planSchema = z.object({
  examDate: dateStr,
  availability: z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), z.coerce.number().int().min(0, 'Durée invalide.').max(600, 'Maximum 10 heures par jour.')),
  levels: z.record(z.coerce.number().int().min(1).max(5)).default({}),
});

/** Crée ou recrée le planning (les séances déjà faites sont conservées). */
router.post('/planning', handler((req, res) => {
  const data = validate(planSchema, req.body);
  const today = todayISO();
  if (data.examDate <= today) throw new HttpError(400, 'La date d’examen doit être dans le futur.');
  const weekly = Object.values(data.availability).reduce((a, b) => a + b, 0);
  if (weekly < 30) throw new HttpError(400, 'Indiquez au moins 30 minutes de disponibilité par semaine.');

  const subjects = getProgramTree().map((s) => ({ id: s.id, chapters: s.chapters.map((c) => ({ id: c.id })) }));
  const items = generatePlan({ startDate: today, examDate: data.examDate, availability: data.availability, levels: data.levels, subjects });
  if (!items.length) throw new HttpError(400, 'Impossible de générer un planning : vérifiez vos disponibilités (créneaux d’au moins 25 minutes).');

  tx(() => {
    const existing = one('SELECT id FROM plans WHERE user_id = ?', req.user.id);
    let planId;
    if (existing) {
      planId = existing.id;
      run('UPDATE plans SET exam_date = ?, availability = ?, levels = ? WHERE id = ?', data.examDate, JSON.stringify(data.availability), JSON.stringify(data.levels), planId);
      run("DELETE FROM plan_items WHERE plan_id = ? AND (status = 'prevu' OR (status = 'manque' AND date >= ?))", planId, today);
    } else {
      planId = Number(run('INSERT INTO plans (user_id, exam_date, availability, levels) VALUES (?, ?, ?, ?)', req.user.id, data.examDate, JSON.stringify(data.availability), JSON.stringify(data.levels)).lastInsertRowid);
    }
    for (const it of items) {
      run('INSERT INTO plan_items (plan_id, user_id, date, subject_id, chapter_id, activity, duration_min) VALUES (?, ?, ?, ?, ?, ?, ?)', planId, req.user.id, it.date, it.subject_id, it.chapter_id, it.activity, it.duration_min);
    }
    run('UPDATE users SET exam_date = ?, levels = ? WHERE id = ?', data.examDate, JSON.stringify(data.levels), req.user.id);
  });
  res.status(201).json({ created: items.length });
}));

router.patch('/planning/items/:id', handler((req, res) => {
  const itemId = toId(req.params.id);
  const item = one('SELECT * FROM plan_items WHERE id = ? AND user_id = ?', itemId, req.user.id);
  if (!item) throw new HttpError(404, 'Séance introuvable.');
  const data = validate(z.object({ status: z.enum(['prevu', 'fait']).optional(), date: dateStr.optional() }), req.body);
  if (data.date && data.date < todayISO()) throw new HttpError(400, 'Impossible de déplacer une séance dans le passé.');
  run('UPDATE plan_items SET status = COALESCE(?, status), date = COALESCE(?, date) WHERE id = ?', data.status ?? null, data.date ?? null, itemId);
  res.json({ item: one('SELECT * FROM plan_items WHERE id = ?', itemId) });
}));

router.delete('/planning', handler((req, res) => {
  run('DELETE FROM plans WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
}));

export default router;
