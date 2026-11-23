/**
 * Répétition espacée (variante de SM-2 à 4 niveaux).
 *
 * Notes possibles :
 *   0 « À revoir »  : carte oubliée -> réapprentissage (revue dans 10 minutes)
 *   1 « Difficile » : rappel laborieux -> intervalle légèrement augmenté, facilité réduite
 *   2 « Correct »   : rappel normal
 *   3 « Facile »    : rappel immédiat -> intervalle fortement augmenté
 */

export const GRADES = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 };
export const GRADE_LABELS = ['À revoir', 'Difficile', 'Correct', 'Facile'];
export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;
export const MAX_INTERVAL_DAYS = 365;
const DAY_MS = 86_400_000;

export function initialState() {
  return { ease: DEFAULT_EASE, interval: 0, repetitions: 0, lapses: 0, due_at: null, last_grade: null };
}

/**
 * Calcule le nouvel état d'une carte après une révision.
 * @param {object} state  état courant (voir initialState)
 * @param {number} grade  0..3
 * @param {Date} now
 * @returns {object} nouvel état, `due_at` au format ISO, `interval` en jours (peut être fractionnaire)
 */
export function schedule(state, grade, now = new Date()) {
  if (![0, 1, 2, 3].includes(grade)) throw new RangeError('La note doit être comprise entre 0 et 3');
  const s = { ...initialState(), ...(state || {}) };
  let { ease, interval, repetitions, lapses } = s;

  if (grade === GRADES.AGAIN) {
    lapses += 1;
    repetitions = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
    interval = 10 / 1440; // 10 minutes
  } else {
    if (grade === GRADES.HARD) ease = Math.max(MIN_EASE, ease - 0.15);
    if (grade === GRADES.EASY) ease = ease + 0.15;

    if (repetitions === 0) {
      interval = grade === GRADES.HARD ? 1 : grade === GRADES.GOOD ? 1 : 4;
    } else if (repetitions === 1) {
      interval = grade === GRADES.HARD ? 2 : grade === GRADES.GOOD ? 3 : 6;
    } else {
      const factor = grade === GRADES.HARD ? 1.2 : grade === GRADES.GOOD ? ease : ease * 1.3;
      interval = Math.max(interval + 1, interval * factor);
    }
    repetitions += 1;
  }

  interval = Math.min(MAX_INTERVAL_DAYS, interval);
  const due = new Date(now.getTime() + interval * DAY_MS);
  return {
    ease: Math.round(ease * 100) / 100,
    interval: Math.round(interval * 1000) / 1000,
    repetitions,
    lapses,
    last_grade: grade,
    due_at: due.toISOString(),
  };
}

/**
 * Score de priorité d'une carte (plus élevé = à réviser en premier).
 * Favorise les cartes en retard, oubliées souvent (lapses) et à faible facilité.
 * Les cartes jamais vues ont une priorité moyenne, derrière les cartes en retard.
 */
export function priority(card, now = new Date()) {
  if (!card.due_at) return 1; // nouvelle carte
  const overdueDays = (now.getTime() - new Date(card.due_at).getTime()) / DAY_MS;
  if (overdueDays < 0) return -1; // pas encore due
  const fragility = (card.lapses || 0) * 0.5 + (DEFAULT_EASE - (card.ease ?? DEFAULT_EASE));
  const relativeDelay = overdueDays / Math.max(1, card.interval || 1);
  return 2 + relativeDelay + fragility + (card.last_grade === 0 ? 1 : 0);
}

/**
 * Construit la file de révision : cartes dues (par priorité), puis nouvelles cartes.
 * @param {Array} cards  cartes avec état SRS éventuel (due_at null si jamais vue)
 */
export function buildQueue(cards, { now = new Date(), limit = 20, newLimit = 10 } = {}) {
  const due = cards
    .filter((c) => c.due_at && new Date(c.due_at) <= now)
    .sort((a, b) => priority(b, now) - priority(a, now));
  const fresh = cards.filter((c) => !c.due_at).slice(0, newLimit);
  return [...due, ...fresh].slice(0, limit);
}
