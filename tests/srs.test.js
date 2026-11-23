import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, initialState, priority, buildQueue, GRADES, MIN_EASE } from '../shared/srs.js';

const now = new Date('2026-05-01T08:00:00Z');
const days = (iso) => (new Date(iso) - now) / 86_400_000;

test('première révision : intervalles selon la note', () => {
  assert.equal(schedule(initialState(), GRADES.GOOD, now).interval, 1);
  assert.equal(schedule(initialState(), GRADES.EASY, now).interval, 4);
  const again = schedule(initialState(), GRADES.AGAIN, now);
  assert.ok(again.interval < 0.01);
  assert.equal(again.lapses, 1);
});

test('les intervalles croissent avec les bonnes réponses', () => {
  let s = initialState();
  const intervals = [];
  for (let i = 0; i < 5; i++) {
    s = schedule(s, GRADES.GOOD, now);
    intervals.push(s.interval);
  }
  for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i] > intervals[i - 1]);
  assert.equal(s.repetitions, 5);
});

test('« Facile » espace plus que « Correct », qui espace plus que « Difficile »', () => {
  const base = schedule(schedule(initialState(), GRADES.GOOD, now), GRADES.GOOD, now);
  const hard = schedule(base, GRADES.HARD, now);
  const good = schedule(base, GRADES.GOOD, now);
  const easy = schedule(base, GRADES.EASY, now);
  assert.ok(hard.interval < good.interval && good.interval < easy.interval);
  assert.ok(hard.ease < good.ease && good.ease < easy.ease);
});

test('« À revoir » réinitialise la série et réduit la facilité sans passer sous le minimum', () => {
  let s = initialState();
  for (let i = 0; i < 3; i++) s = schedule(s, GRADES.GOOD, now);
  s = schedule(s, GRADES.AGAIN, now);
  assert.equal(s.repetitions, 0);
  for (let i = 0; i < 20; i++) s = schedule(s, GRADES.AGAIN, now);
  assert.equal(s.ease, MIN_EASE);
});

test('due_at correspond à l’intervalle', () => {
  const s = schedule(initialState(), GRADES.EASY, now);
  assert.equal(Math.round(days(s.due_at)), 4);
});

test('note invalide refusée', () => {
  assert.throws(() => schedule(initialState(), 5, now), RangeError);
});

test('priorité : cartes fragiles et en retard en tête de file', () => {
  const past = (d) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const future = new Date(now.getTime() + 86_400_000).toISOString();
  const cards = [
    { id: 'nouvelle', due_at: null },
    { id: 'pas-due', due_at: future, interval: 3, ease: 2.5, lapses: 0 },
    { id: 'retard-leger', due_at: past(0.5), interval: 10, ease: 2.5, lapses: 0 },
    { id: 'fragile', due_at: past(0.5), interval: 1, ease: 1.5, lapses: 3, last_grade: 0 },
  ];
  assert.ok(priority(cards[3], now) > priority(cards[2], now));
  assert.equal(priority(cards[1], now), -1);
  const q = buildQueue(cards, { now });
  assert.deepEqual(q.map((c) => c.id), ['fragile', 'retard-leger', 'nouvelle']);
});
