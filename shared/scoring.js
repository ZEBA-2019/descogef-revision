/**
 * Correction des réponses et calcul des scores.
 * Module pur (sans E/S) : utilisé par le serveur et testé unitairement.
 *
 * Types de questions :
 *  - mcq        : QCM. answer = id de choix ou tableau d'ids. Plusieurs bonnes réponses possibles.
 *  - truefalse  : Vrai/Faux. question.answer = { value: true|false }
 *  - short      : réponse courte. question.answer = { accepted: ["..."] }
 *  - calc       : calcul. question.answer = { value: 1234.5, tolerance?: 0.5, relTolerance?: 0.01, unit?: "FCFA" }
 *  - match      : association. question.answer = { left: [...], right: [...], pairs: [[0,2],[1,0],...] }
 *                 answer utilisateur = { "0": 2, "1": 0, ... } (index gauche -> index droite)
 */

export const DIFFICULTY_WEIGHT = { 1: 1, 2: 1.5, 3: 2 };

/** Normalise un texte : minuscules, sans accents, ponctuation ni espaces multiples. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`"«»]/g, ' ')
    .replace(/[^a-z0-9%.,\- ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convertit une saisie numérique au format français ou anglais en nombre.
 * "1 234,56" -> 1234.56 ; "1,234.56" -> 1234.56 ; "12 %" -> 12 ; "-3,5" -> -3.5
 */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;
  let s = String(value).trim().replace(/[\s  ]/g, '').replace(/(fcfa|f|cfa|%|€|xof)$/i, '');
  if (s === '') return NaN;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Le dernier séparateur est le séparateur décimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return Number(s);
}

/**
 * Corrige une réponse.
 * @param {object} question  { type, answer, choices?: [{id, is_correct}] }
 * @param {*} userAnswer
 * @returns {{ correct: boolean, score: number, expected: * }} score entre 0 et 1
 */
export function gradeAnswer(question, userAnswer) {
  const spec = question.answer || {};
  switch (question.type) {
    case 'mcq': {
      const correctIds = (question.choices || []).filter((c) => c.is_correct).map((c) => Number(c.id)).sort();
      const given = (Array.isArray(userAnswer) ? userAnswer : userAnswer == null ? [] : [userAnswer])
        .map(Number)
        .sort();
      const correct = correctIds.length === given.length && correctIds.every((id, i) => id === given[i]);
      return { correct, score: correct ? 1 : 0, expected: correctIds };
    }
    case 'truefalse': {
      const given = userAnswer === true || userAnswer === 'true' ? true : userAnswer === false || userAnswer === 'false' ? false : null;
      const correct = given !== null && given === Boolean(spec.value);
      return { correct, score: correct ? 1 : 0, expected: Boolean(spec.value) };
    }
    case 'short': {
      const accepted = (spec.accepted || []).map(normalizeText);
      const given = normalizeText(userAnswer);
      const correct = given.length > 0 && accepted.includes(given);
      return { correct, score: correct ? 1 : 0, expected: spec.accepted?.[0] ?? '' };
    }
    case 'calc': {
      const expected = Number(spec.value);
      const given = parseNumber(userAnswer);
      if (Number.isNaN(given)) return { correct: false, score: 0, expected };
      const absTol = spec.tolerance ?? 0;
      const relTol = spec.relTolerance ?? 0;
      const tol = Math.max(absTol, Math.abs(expected) * relTol, 1e-9);
      const correct = Math.abs(given - expected) <= tol;
      return { correct, score: correct ? 1 : 0, expected };
    }
    case 'match': {
      const pairs = spec.pairs || [];
      const given = userAnswer && typeof userAnswer === 'object' ? userAnswer : {};
      const good = pairs.filter(([l, r]) => Number(given[l]) === r).length;
      const score = pairs.length ? good / pairs.length : 0;
      return { correct: pairs.length > 0 && good === pairs.length, score, expected: pairs };
    }
    default:
      throw new Error(`Type de question inconnu : ${question.type}`);
  }
}

/**
 * Agrège les résultats d'une série en tenant compte de la difficulté.
 * @param {Array<{score:number, difficulty:number}>} results
 * @returns {{ points:number, maxPoints:number, percent:number, outOf20:number, correctCount:number, total:number }}
 */
export function computeAttemptScore(results) {
  let points = 0;
  let maxPoints = 0;
  let correctCount = 0;
  for (const r of results) {
    const w = DIFFICULTY_WEIGHT[r.difficulty] ?? 1;
    points += w * Math.max(0, Math.min(1, Number(r.score) || 0));
    maxPoints += w;
    if (r.score >= 1) correctCount += 1;
  }
  const ratio = maxPoints ? points / maxPoints : 0;
  return {
    points: round(points, 2),
    maxPoints: round(maxPoints, 2),
    percent: round(ratio * 100, 1),
    outOf20: round(ratio * 20, 2),
    correctCount,
    total: results.length,
  };
}

/** Mention indicative selon une note sur 20. */
export function mention(outOf20) {
  if (outOf20 >= 16) return 'Très bien';
  if (outOf20 >= 14) return 'Bien';
  if (outOf20 >= 12) return 'Assez bien';
  if (outOf20 >= 10) return 'Passable';
  return 'Insuffisant';
}

export function round(n, d = 0) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
