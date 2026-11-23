import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masteryFromResults, chapterProgress, computeProgress, weakChapters, recurringErrors, streakDays, isExamReady } from '../shared/progress.js';
import { recommendNext } from '../shared/recommend.js';

const r = (score, i, difficulty = 1, extra = {}) => ({ score, difficulty, created_at: `2026-01-${String(i).padStart(2, '0')}T10:00:00Z`, ...extra });

test('maîtrise nulle sans résultat', () => {
  assert.deepEqual(masteryFromResults([]), { mastery: 0, accuracy: 0, confidence: 0, count: 0 });
});

test('les résultats récents pèsent davantage', () => {
  const improving = masteryFromResults([r(0, 1), r(0, 2), r(1, 3), r(1, 4)]);
  const declining = masteryFromResults([r(1, 1), r(1, 2), r(0, 3), r(0, 4)]);
  assert.equal(improving.accuracy, declining.accuracy);
  assert.ok(improving.mastery > declining.mastery);
});

test('la confiance croît avec le nombre de réponses', () => {
  assert.ok(masteryFromResults([r(1, 1)]).confidence < masteryFromResults([r(1, 1), r(1, 2), r(1, 3), r(1, 4), r(1, 5), r(1, 6)]).confidence);
  assert.equal(masteryFromResults(Array.from({ length: 10 }, (_, i) => r(1, i + 1))).confidence, 1);
});

test('progression de chapitre : questions + fiches', () => {
  const allGood = Array.from({ length: 6 }, (_, i) => r(1, i + 1));
  assert.equal(chapterProgress({ results: allGood, sheetsTotal: 1, sheetsMastered: 1 }).progress, 100);
  assert.equal(chapterProgress({ results: allGood, sheetsTotal: 1, sheetsMastered: 0 }).progress, 75);
  assert.equal(chapterProgress({ results: [], sheetsTotal: 2, sheetsMastered: 2 }).progress, 25);
  assert.equal(chapterProgress({ results: [] }).progress, 0);
});

test('une bonne réponse fait progresser, une mauvaise non', () => {
  const base = [r(1, 1), r(0, 2)];
  const after = chapterProgress({ results: [...base, r(1, 3)] }).progress;
  const afterBad = chapterProgress({ results: [...base, r(0, 3)] }).progress;
  const before = chapterProgress({ results: base }).progress;
  assert.ok(after > before);
  assert.ok(afterBad < after);
});

test('computeProgress agrège chapitres et matières', () => {
  const subjects = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }];
  const chapters = [{ id: 10, subject_id: 1, title: 'A1' }, { id: 11, subject_id: 1, title: 'A2' }, { id: 20, subject_id: 2, title: 'B1' }];
  const results = Array.from({ length: 6 }, (_, i) => ({ ...r(1, i + 1), chapter_id: 10 }));
  const p = computeProgress({ subjects, chapters, results, sheets: [] });
  assert.equal(p.chapters.find((c) => c.chapterId === 10).progress, 100);
  assert.equal(p.subjects.find((s) => s.subjectId === 1).progress, 50);
  assert.equal(p.subjects.find((s) => s.subjectId === 2).progress, 0);
  assert.equal(p.overall, 25);
});

test('weakChapters ignore les chapitres sans données suffisantes', () => {
  const stats = [
    { chapterId: 1, title: 'Faible', mastery: 0.2, confidence: 1, count: 6 },
    { chapterId: 2, title: 'Un seul essai', mastery: 0, confidence: 0.2, count: 1 },
    { chapterId: 3, title: 'Bon', mastery: 0.9, confidence: 1, count: 6 },
    { chapterId: 4, title: 'Moyen', mastery: 0.5, confidence: 0.5, count: 3 },
  ];
  const weak = weakChapters(stats);
  assert.deepEqual(weak.map((w) => w.chapterId), [1, 4]);
});

test('recurringErrors classe les compétences par taux d’erreur', () => {
  const res = [
    { competency: 'Calcul', score: 0 }, { competency: 'Calcul', score: 0 }, { competency: 'Calcul', score: 1 },
    { competency: 'Écritures', score: 1 }, { competency: 'Écritures', score: 0 },
    { competency: 'Isolée', score: 0 },
  ];
  const errs = recurringErrors(res);
  assert.equal(errs[0].competency, 'Calcul');
  assert.equal(errs.length, 2);
});

test('streakDays compte les jours consécutifs', () => {
  const today = new Date('2026-03-10T12:00:00Z');
  assert.equal(streakDays(['2026-03-10', '2026-03-09', '2026-03-08', '2026-03-06'], today), 3);
  assert.equal(streakDays(['2026-03-09', '2026-03-08'], today), 2);
  assert.equal(streakDays(['2026-03-07'], today), 0);
});

test('weakChapters avec minCount 1 classe les chapitres peu documentés après les plus fiables', () => {
  const stats = [
    { chapterId: 1, title: 'Un essai', mastery: 0, confidence: 1 / 6, count: 1 },
    { chapterId: 2, title: 'Faible', mastery: 0.3, confidence: 1, count: 6 },
  ];
  assert.deepEqual(weakChapters(stats, { minCount: 1 }).map((w) => w.chapterId), [2, 1]);
});

test('examen blanc recommandé seulement si tous les chapitres sont assez travaillés', () => {
  const chapters = [{ count: 1 }, { count: 5 }];
  assert.equal(isExamReady({ chapters, overall: 80 }), false);
  assert.equal(isExamReady({ chapters: [{ count: 3 }, { count: 4 }], overall: 30 }), false);
  assert.equal(isExamReady({ chapters: [{ count: 3 }, { count: 4 }], overall: 45 }), true);
});

test('recommandation : diagnostic, puis lacunes avant examen blanc', () => {
  assert.equal(recommendNext({ diagnosticDone: false }).type, 'diagnostic');
  const weak = [{ chapterId: 7, title: 'VAN', mastery: 0.2 }];
  const r = recommendNext({ diagnosticDone: true, weak, examReady: true });
  assert.equal(r.type, 'quiz');
  assert.equal(r.chapterId, 7);
  assert.equal(recommendNext({ diagnosticDone: true, dueFlashcards: 8, weak }).type, 'flashcards');
  assert.equal(recommendNext({ diagnosticDone: true, examReady: true }).type, 'examen');
});
