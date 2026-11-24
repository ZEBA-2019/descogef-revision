/**
 * Test d'intégration du parcours prioritaire :
 * inscription → diagnostic initial → tableau de bord → quiz → correction → mise à jour de la progression.
 * Utilise une base SQLite en mémoire.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_PATH = ':memory:';
process.env.ADMIN_PASSWORD = 'AdminTest123';

const { closeDb, run } = await import('../server/db.js');
const { initDatabase } = await import('../server/seed.js');
const { createApp } = await import('../server/app.js');
const { loadQuestions } = await import('../server/services.js');
const { gradeAnswer } = await import('../shared/scoring.js');

let server;
let base;

before(async () => {
  await initDatabase();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server?.close();
  await closeDb();
});

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
}

/** Construit une bonne réponse à partir de la question complète (côté serveur). */
function correctAnswerFor(q) {
  switch (q.type) {
    case 'mcq': return q.choices.find((c) => c.is_correct).id;
    case 'truefalse': return q.answer.value;
    case 'short': return q.answer.accepted[0];
    case 'calc': return String(q.answer.value).replace('.', ',');
    case 'match': return Object.fromEntries(q.answer.pairs.map(([l, r]) => [l, r]));
  }
}

test('parcours complet : inscription → diagnostic → quiz → progression', async () => {
  const api = client();

  // Validation des formulaires
  const bad = await api('POST', '/auth/register', { name: 'A', email: 'pas-un-email', password: 'court' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error);

  // Inscription
  const reg = await api('POST', '/auth/register', { name: 'Awa Traoré', email: 'awa@example.com', password: 'Revision2026' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.diagnosticDone, false);
  const dup = await client()('POST', '/auth/register', { name: 'Awa', email: 'AWA@example.com', password: 'Revision2026' });
  assert.equal(dup.status, 409);

  // Tableau de bord avant diagnostic : recommande le diagnostic
  let dash = await api('GET', '/dashboard');
  assert.equal(dash.body.recommendation.type, 'diagnostic');
  assert.equal(dash.body.overall, 0);

  // Diagnostic initial
  const diag = await api('POST', '/diagnostic/start');
  assert.equal(diag.status, 201);
  const diagQs = diag.body.attempt.questions;
  assert.equal(diagQs.length, 9);
  for (const q of diagQs) {
    assert.equal(q.choices?.some((c) => 'is_correct' in c) ?? false, false, 'les réponses ne doivent pas fuiter');
    assert.equal('answer' in q, false);
    assert.equal('explanation' in q, false);
  }
  const full = await loadQuestions(diagQs.map((q) => q.id));
  // Réponses correctes aux questions de la 1re matière, fausses ailleurs
  const firstSubject = diagQs[0].subjectId;
  for (const q of full) {
    const answer = q.subject_id === firstSubject ? correctAnswerFor(q) : q.type === 'truefalse' ? !q.answer.value : 'faux';
    const r = await api('POST', `/attempts/${diag.body.attempt.id}/answer`, { questionId: q.id, answer, timeSec: 20 });
    assert.equal(r.status, 200);
    assert.equal(r.body.correction.correct, q.subject_id === firstSubject);
    assert.ok(r.body.correction.explanation);
  }
  const again = await api('POST', `/attempts/${diag.body.attempt.id}/answer`, { questionId: full[0].id, answer: 'x' });
  assert.equal(again.status, 409, 'pas de double réponse');

  const fin = await api('POST', `/attempts/${diag.body.attempt.id}/finish`, { levels: { [firstSubject]: 4 }, examDate: '2027-06-15' });
  assert.equal(fin.status, 200);
  assert.equal(fin.body.summary.score.correctCount, 3);
  assert.ok(fin.body.summary.overallAfter > fin.body.summary.overallBefore);

  const me = await api('GET', '/auth/me');
  assert.equal(me.body.user.diagnosticDone, true);
  assert.equal(me.body.user.examDate, '2027-06-15');

  // Tableau de bord après diagnostic
  dash = await api('GET', '/dashboard');
  assert.notEqual(dash.body.recommendation.type, 'diagnostic');
  assert.ok(dash.body.overall > 0);
  assert.equal(dash.body.answered, 9);
  assert.ok(dash.body.timeTotalSec >= 180);
  const s1Before = dash.body.subjects.find((s) => s.subjectId === firstSubject).progress;
  const other = dash.body.subjects.find((s) => s.subjectId !== firstSubject);

  // Quiz personnalisé sur une matière faible, toutes réponses justes
  const quiz = await api('POST', '/quiz/start', { mode: 'personnalise', subjectId: other.subjectId, count: 10 });
  assert.equal(quiz.status, 201);
  assert.equal(quiz.body.attempt.questions.length, 10);
  for (const q of await loadQuestions(quiz.body.attempt.questions.map((x) => x.id))) {
    const r = await api('POST', `/attempts/${quiz.body.attempt.id}/answer`, { questionId: q.id, answer: correctAnswerFor(q), timeSec: 30 });
    assert.equal(r.body.correction.correct, true, `question ${q.id} (${q.type}) devrait être juste`);
  }
  const qfin = await api('POST', `/attempts/${quiz.body.attempt.id}/finish`, {});
  assert.equal(qfin.body.summary.score.outOf20, 20);
  const subj = qfin.body.summary.subjects.find((s) => s.subjectId === other.subjectId);
  assert.ok(subj.delta > 0, 'la progression de la matière travaillée augmente');
  assert.ok(subj.progress > other.progress);
  assert.equal(qfin.body.summary.subjects.find((s) => s.subjectId === firstSubject).progress, s1Before);

  // Validation : nombre de questions non autorisé
  const badCount = await api('POST', '/quiz/start', { count: 7 });
  assert.equal(badCount.status, 400);

  // Statistiques disponibles
  const stats = await api('GET', '/stats');
  assert.equal(stats.body.timeline.length, 2);
});

test('sécurité : accès non authentifié et administration', async () => {
  const anon = client();
  assert.equal((await anon('GET', '/dashboard')).status, 401);
  assert.equal((await anon('GET', '/admin/subjects')).status, 401);

  const student = client();
  await student('POST', '/auth/register', { name: 'Koffi', email: 'koffi@example.com', password: 'Revision2026' });
  assert.equal((await student('GET', '/admin/subjects')).status, 403);

  const admin = client();
  const login = await admin('POST', '/auth/login', { email: 'admin@descogef.local', password: 'AdminTest123' });
  assert.equal(login.status, 200);
  const wrong = await client()('POST', '/auth/login', { email: 'admin@descogef.local', password: 'mauvais' });
  assert.equal(wrong.status, 401);

  // Création d'une question validée côté serveur
  const chapters = await admin('GET', '/admin/chapters');
  const invalid = await admin('POST', '/admin/questions', { chapter_id: chapters.body.items[0].id, type: 'mcq', prompt: 'Q ?', difficulty: 1, choices: [{ label: 'A' }, { label: 'B' }] });
  assert.equal(invalid.status, 400);
  const created = await admin('POST', '/admin/questions', {
    chapter_id: chapters.body.items[0].id, type: 'calc', prompt: 'Combien ?', difficulty: 2, answer: { value: 42 }, explanation: 'Parce que.',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.item.answer.value, 42);
  assert.equal(gradeAnswer(created.body.item, '42').correct, true);
});

test('examen blanc, flashcards, planning et cas pratique', async () => {
  const api = client();
  await api('POST', '/auth/register', { name: 'Fatou', email: 'fatou@example.com', password: 'Revision2026' });

  // Examen blanc : sujet équilibré, sauvegarde automatique, remise automatique après le temps imparti
  const exams = await api('GET', '/exams');
  const start = await api('POST', `/exams/${exams.body.exams[0].id}/start`);
  assert.equal(start.status, 201);
  const qs = start.body.attempt.questions;
  assert.equal(qs.length, 12);
  for (const sid of new Set(qs.map((q) => q.subjectId))) assert.equal(qs.filter((q) => q.subjectId === sid).length, 4);
  const [firstQ] = await loadQuestions([qs[0].id]);
  const saved = await api('PUT', `/attempts/${start.body.attempt.id}/autosave`, { answers: { [firstQ.id]: correctAnswerFor(firstQ) }, currentIndex: 1 });
  assert.equal(saved.status, 200);
  const resumed = await api('POST', `/exams/${exams.body.exams[0].id}/start`);
  assert.equal(resumed.body.resumed, true);
  assert.equal(resumed.body.attempt.state.currentIndex, 1);
  // On simule l'expiration du temps
  const a = start.body.attempt;
  await run(`UPDATE attempts SET state = jsonb_set(state::jsonb, '{deadline}', '"2000-01-01T00:00:00.000Z"')::text WHERE id = ?`, a.id);
  const after = await api('GET', `/attempts/${a.id}`);
  assert.equal(after.body.attempt.status, 'termine');
  const review = await api('GET', `/attempts/${a.id}/review`);
  assert.equal(review.body.items.length, 12);
  assert.equal(review.body.items.filter((i) => i.correction.correct).length, 1, 'la réponse sauvegardée est corrigée');

  // Flashcards : la carte notée « À revoir » revient dans la file, « Facile » non
  const q1 = await api('GET', '/flashcards/queue?limit=5');
  assert.equal(q1.body.totals.fresh, 20);
  const [c1, c2] = q1.body.queue;
  await api('POST', `/flashcards/${c1.id}/review`, { grade: 0 });
  await api('POST', `/flashcards/${c2.id}/review`, { grade: 3 });
  await run("UPDATE flashcard_states SET due_at = '2000-01-01T00:00:00.000Z' WHERE flashcard_id = ? ", c1.id);
  const q2 = await api('GET', '/flashcards/queue?limit=40');
  assert.equal(q2.body.queue[0].id, c1.id, 'la carte oubliée est prioritaire');
  assert.ok(!q2.body.queue.some((c) => c.id === c2.id));

  // Planning : génération puis report d'une séance manquée
  const examDate = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const availability = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 };
  const bad = await api('POST', '/planning', { examDate: '2000-01-01', availability });
  assert.equal(bad.status, 400);
  const plan = await api('POST', '/planning', { examDate, availability, levels: {} });
  assert.equal(plan.status, 201);
  assert.ok(plan.body.created > 30);
  await run("UPDATE plan_items SET date = '2000-01-01' WHERE id = (SELECT MIN(id) FROM plan_items)");
  const p = await api('GET', '/planning');
  assert.equal(p.body.rescheduled, 1);
  assert.equal(p.body.totals.missed, 1);

  // Cas pratique : autoévaluation bornée par le barème
  const ex = await api('GET', '/exercises/1');
  assert.equal('solution' in ex.body.exercise.items[0], false, 'le corrigé n’est pas envoyé avec l’énoncé');
  const n = ex.body.exercise.items.length;
  const over = await api('POST', '/exercises/1/attempts', { answers: Array(n).fill(''), selfScores: Array(n).fill(999), durationSec: 60 });
  assert.equal(over.status, 400);
  const ok = await api('POST', '/exercises/1/attempts', { answers: Array(n).fill('ma réponse'), selfScores: ex.body.exercise.items.map((i) => i.points / 2), durationSec: 600 });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.percent, 50);
});

test('protection CSRF : origine étrangère refusée, serveur de développement accepté', async () => {
  const send = (origin) =>
    fetch(base + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ name: 'Origine', email: `o${Math.random()}@example.com`, password: 'Revision2026' }),
    });
  assert.equal((await send('https://site-malveillant.example')).status, 403);
  assert.equal((await send('http://localhost:5173')).status, 201);
});
