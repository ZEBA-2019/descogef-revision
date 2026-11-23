import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePlan, rescheduleMissed, splitMinutes, subjectWeight } from '../shared/planner.js';

const subjects = [
  { id: 1, chapters: [{ id: 11 }, { id: 12 }] },
  { id: 2, chapters: [{ id: 21 }] },
];
const availability = { 0: 0, 1: 60, 2: 60, 3: 0, 4: 60, 5: 0, 6: 120 };

test('splitMinutes découpe en créneaux réalistes', () => {
  assert.deepEqual(splitMinutes(20), []);
  assert.deepEqual(splitMinutes(45), [45]);
  assert.equal(splitMinutes(150).reduce((a, b) => a + b, 0), 150);
  assert.ok(splitMinutes(150).every((s) => s >= 25 && s <= 90));
});

test('generatePlan respecte les disponibilités et la date d’examen', () => {
  const plan = generatePlan({ startDate: '2026-06-01', examDate: '2026-07-01', availability, levels: {}, subjects });
  assert.ok(plan.length > 0);
  const perDay = new Map();
  for (const it of plan) {
    assert.ok(it.date >= '2026-06-01' && it.date < '2026-07-01');
    perDay.set(it.date, (perDay.get(it.date) || 0) + it.duration_min);
  }
  for (const [date, minutes] of perDay) {
    const dow = new Date(date + 'T12:00:00').getDay();
    assert.ok(minutes <= availability[dow], `${date} dépasse la disponibilité`);
  }
});

test('la matière la plus faible reçoit plus de temps', () => {
  const plan = generatePlan({ startDate: '2026-06-01', examDate: '2026-09-01', availability, levels: { 1: 1, 2: 5 }, subjects });
  const time = (id) => plan.filter((p) => p.subject_id === id).reduce((a, p) => a + p.duration_min, 0);
  assert.ok(time(1) > 2 * time(2));
  assert.ok(subjectWeight(1) > subjectWeight(5));
});

test('phase finale : examens blancs planifiés', () => {
  const plan = generatePlan({ startDate: '2026-06-01', examDate: '2026-08-01', availability, levels: {}, subjects });
  assert.ok(plan.some((p) => p.activity === 'examen' && p.date >= '2026-07-18'));
});

test('date d’examen passée refusée', () => {
  assert.throws(() => generatePlan({ startDate: '2026-06-01', examDate: '2026-05-01', availability, subjects }));
});

test('rescheduleMissed reporte les séances manquées sans dépasser la capacité', () => {
  const items = [
    { id: 1, date: '2026-06-01', status: 'prevu', duration_min: 60, activity: 'quiz', subject_id: 1 },
    { id: 2, date: '2026-06-02', status: 'fait', duration_min: 60, activity: 'quiz', subject_id: 1 },
    { id: 3, date: '2026-06-08', status: 'prevu', duration_min: 60, activity: 'quiz', subject_id: 2 },
  ];
  // 2026-06-08 est un lundi : 60 min dispo (+30 tolérance) déjà occupés par la séance 3
  const { missed, rescheduled } = rescheduleMissed({ items, today: new Date(2026, 5, 8), examDate: '2026-07-01', availability });
  assert.deepEqual(missed.map((m) => m.id), [1]);
  assert.equal(rescheduled.length, 1);
  assert.equal(rescheduled[0].date, '2026-06-09');
  assert.equal(rescheduled[0].rescheduled_from, 1);
});
