import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, computeAttemptScore, parseNumber, normalizeText, mention } from '../shared/scoring.js';

test('parseNumber accepte les formats français et anglais', () => {
  assert.equal(parseNumber('1 234,56'), 1234.56);
  assert.equal(parseNumber('1 234,56'), 1234.56);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('12 %'), 12);
  assert.equal(parseNumber('-3,5'), -3.5);
  assert.equal(parseNumber('2 000 000 FCFA'), 2000000);
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('')));
});

test('normalizeText ignore accents, casse et espaces', () => {
  assert.equal(normalizeText('  Fonds de ROULEMENT  '), 'fonds de roulement');
  assert.equal(normalizeText('Dépréciation'), 'depreciation');
});

test('QCM : une seule et plusieurs bonnes réponses', () => {
  const q = { type: 'mcq', choices: [{ id: 1, is_correct: 0 }, { id: 2, is_correct: 1 }, { id: 3, is_correct: 0 }] };
  assert.equal(gradeAnswer(q, 2).correct, true);
  assert.equal(gradeAnswer(q, '2').correct, true);
  assert.equal(gradeAnswer(q, 1).correct, false);
  assert.equal(gradeAnswer(q, null).correct, false);
  const multi = { type: 'mcq', choices: [{ id: 1, is_correct: 1 }, { id: 2, is_correct: 1 }, { id: 3, is_correct: 0 }] };
  assert.equal(gradeAnswer(multi, [2, 1]).correct, true);
  assert.equal(gradeAnswer(multi, [1]).correct, false);
  assert.equal(gradeAnswer(multi, [1, 2, 3]).correct, false);
});

test('Vrai/Faux', () => {
  const q = { type: 'truefalse', answer: { value: false } };
  assert.equal(gradeAnswer(q, false).correct, true);
  assert.equal(gradeAnswer(q, 'false').correct, true);
  assert.equal(gradeAnswer(q, true).correct, false);
  assert.equal(gradeAnswer(q, undefined).correct, false);
});

test('Réponse courte : variantes acceptées', () => {
  const q = { type: 'short', answer: { accepted: ['Besoin en fonds de roulement', 'BFR'] } };
  assert.equal(gradeAnswer(q, 'bfr').correct, true);
  assert.equal(gradeAnswer(q, ' besoin en fonds de  roulement ').correct, true);
  assert.equal(gradeAnswer(q, 'fonds de roulement').correct, false);
  assert.equal(gradeAnswer(q, '').correct, false);
});

test('Calcul : tolérance absolue et relative', () => {
  const q = { type: 'calc', answer: { value: 1500000, tolerance: 1 } };
  assert.equal(gradeAnswer(q, '1 500 000').correct, true);
  assert.equal(gradeAnswer(q, '1500001').correct, true);
  assert.equal(gradeAnswer(q, '1500002').correct, false);
  const rel = { type: 'calc', answer: { value: 12.5, relTolerance: 0.01 } };
  assert.equal(gradeAnswer(rel, '12,6').correct, true);
  assert.equal(gradeAnswer(rel, '12,7').correct, false);
  assert.equal(gradeAnswer(rel, 'douze').correct, false);
});

test('Association : crédit partiel', () => {
  const q = { type: 'match', answer: { pairs: [[0, 1], [1, 2], [2, 0]] } };
  const full = gradeAnswer(q, { 0: 1, 1: 2, 2: 0 });
  assert.equal(full.correct, true);
  assert.equal(full.score, 1);
  const partial = gradeAnswer(q, { 0: 1, 1: 0, 2: 2 });
  assert.equal(partial.correct, false);
  assert.ok(Math.abs(partial.score - 1 / 3) < 1e-9);
});

test('Type inconnu : erreur explicite', () => {
  assert.throws(() => gradeAnswer({ type: 'essai' }, 'x'), /inconnu/);
});

test('computeAttemptScore pondère par la difficulté', () => {
  const s = computeAttemptScore([
    { score: 1, difficulty: 1 },
    { score: 0, difficulty: 3 },
    { score: 0.5, difficulty: 2 },
  ]);
  // points = 1 + 0 + 0.75 = 1.75 ; max = 1 + 2 + 1.5 = 4.5
  assert.equal(s.points, 1.75);
  assert.equal(s.maxPoints, 4.5);
  assert.equal(s.percent, 38.9);
  assert.equal(s.outOf20, 7.78);
  assert.equal(s.correctCount, 1);
  assert.equal(s.total, 3);
});

test('computeAttemptScore : série vide', () => {
  const s = computeAttemptScore([]);
  assert.equal(s.percent, 0);
  assert.equal(s.outOf20, 0);
});

test('mention', () => {
  assert.equal(mention(9.99), 'Insuffisant');
  assert.equal(mention(10), 'Passable');
  assert.equal(mention(16), 'Très bien');
});
