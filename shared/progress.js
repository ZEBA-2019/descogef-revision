/**
 * Calcul de la progression et détection des lacunes.
 * Module pur : reçoit des résultats bruts, renvoie des indicateurs.
 */
import { DIFFICULTY_WEIGHT, round } from './scoring.js';

/** Poids d'oubli : chaque résultat plus ancien compte 15 % de moins que le suivant. */
export const RECENCY_DECAY = 0.85;
/** Nombre de réponses à partir duquel la maîtrise d'un chapitre est jugée fiable. */
export const CONFIDENCE_THRESHOLD = 6;
export const MASTERY_TARGET = 0.8;
export const WEAK_THRESHOLD = 0.6;

/**
 * Maîtrise d'un ensemble de résultats (0..1), pondérée par la récence et la difficulté.
 * @param {Array<{score:number, difficulty:number, created_at:string}>} results
 */
export function masteryFromResults(results) {
  if (!results.length) return { mastery: 0, accuracy: 0, confidence: 0, count: 0 };
  const sorted = [...results].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  let num = 0;
  let den = 0;
  let correct = 0;
  const n = sorted.length;
  sorted.forEach((r, i) => {
    const w = RECENCY_DECAY ** (n - 1 - i) * (DIFFICULTY_WEIGHT[r.difficulty] ?? 1);
    num += w * r.score;
    den += w;
    if (r.score >= 1) correct += 1;
  });
  const confidence = Math.min(1, n / CONFIDENCE_THRESHOLD);
  return {
    mastery: round(num / den, 3),
    accuracy: round(correct / n, 3),
    confidence: round(confidence, 3),
    count: n,
  };
}

/**
 * Progression d'un chapitre (0..100).
 * 75 % : maîtrise des questions (pondérée par la confiance) ; 25 % : fiches « Maîtrisé ».
 */
export function chapterProgress({ results = [], sheetsTotal = 0, sheetsMastered = 0, sheetsInProgress = 0 }) {
  const m = masteryFromResults(results);
  const quizPart = m.mastery * m.confidence;
  const sheetPart = sheetsTotal ? (sheetsMastered + 0.5 * sheetsInProgress) / sheetsTotal : quizPart;
  const progress = 0.75 * quizPart + 0.25 * sheetPart;
  return { ...m, progress: round(progress * 100, 1) };
}

/**
 * Calcule la progression par chapitre, par matière, et globale.
 * @param {object} p
 * @param {Array<{id, title}>} p.subjects
 * @param {Array<{id, subject_id, title}>} p.chapters
 * @param {Array<{chapter_id, score, difficulty, created_at}>} p.results
 * @param {Array<{chapter_id, status}>} p.sheets  fiches avec statut de l'utilisateur
 */
export function computeProgress({ subjects, chapters, results, sheets = [] }) {
  const byChapter = new Map(chapters.map((c) => [c.id, []]));
  for (const r of results) if (byChapter.has(r.chapter_id)) byChapter.get(r.chapter_id).push(r);

  const chapterStats = chapters.map((c) => {
    const cs = sheets.filter((s) => s.chapter_id === c.id);
    const stats = chapterProgress({
      results: byChapter.get(c.id),
      sheetsTotal: cs.length,
      sheetsMastered: cs.filter((s) => s.status === 'maitrise').length,
      sheetsInProgress: cs.filter((s) => s.status === 'en_cours').length,
    });
    return { chapterId: c.id, subjectId: c.subject_id, title: c.title, ...stats };
  });

  const subjectStats = subjects.map((s) => {
    const cs = chapterStats.filter((c) => c.subjectId === s.id);
    const progress = cs.length ? cs.reduce((a, c) => a + c.progress, 0) / cs.length : 0;
    const count = cs.reduce((a, c) => a + c.count, 0);
    const answered = cs.filter((c) => c.count > 0);
    const accuracy = count ? cs.reduce((a, c) => a + c.accuracy * c.count, 0) / count : 0;
    return {
      subjectId: s.id,
      title: s.title,
      progress: round(progress, 1),
      accuracy: round(accuracy, 3),
      count,
      chaptersStarted: answered.length,
      chaptersTotal: cs.length,
    };
  });

  const overall = subjectStats.length
    ? round(subjectStats.reduce((a, s) => a + s.progress, 0) / subjectStats.length, 1)
    : 0;

  return { overall, subjects: subjectStats, chapters: chapterStats };
}

/**
 * Notions à revoir : chapitres faibles (avec assez de données) ou jamais travaillés.
 * Triés par priorité décroissante.
 */
export function weakChapters(chapterStats, { limit = 5, minCount = 2 } = {}) {
  return chapterStats
    .filter((c) => c.count >= minCount && c.mastery < WEAK_THRESHOLD)
    .map((c) => ({ ...c, priority: round((1 - c.mastery) * (0.5 + 0.5 * c.confidence), 3) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

/**
 * Un examen blanc n'est recommandé que si chaque chapitre a été travaillé
 * suffisamment (3 réponses) et que la progression générale atteint 40 %.
 */
export function isExamReady(progress, { minPerChapter = 3, minOverall = 40 } = {}) {
  return progress.chapters.length > 0 && progress.chapters.every((c) => c.count >= minPerChapter) && progress.overall >= minOverall;
}

/**
 * Erreurs récurrentes : regroupe les résultats par compétence et repère les taux d'erreur élevés.
 * @param {Array<{competency:string, score:number}>} results
 */
export function recurringErrors(results, { minCount = 2, limit = 6 } = {}) {
  const groups = new Map();
  for (const r of results) {
    const key = r.competency || 'Non classé';
    const g = groups.get(key) || { competency: key, total: 0, errors: 0 };
    g.total += 1;
    if (r.score < 1) g.errors += 1;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.total >= minCount && g.errors > 0)
    .map((g) => ({ ...g, errorRate: round(g.errors / g.total, 3) }))
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .slice(0, limit);
}

/** Série de jours consécutifs avec au moins une activité (jusqu'à aujourd'hui ou hier). */
export function streakDays(activityDates, today = new Date()) {
  const days = new Set(activityDates.map((d) => String(d).slice(0, 10)));
  let streak = 0;
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
