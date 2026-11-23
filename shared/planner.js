/**
 * Planificateur de révisions.
 * Génère un programme réaliste à partir de la date d'examen, des disponibilités
 * hebdomadaires et du niveau déclaré dans chaque matière, puis réorganise les séances manquées.
 */

export const ACTIVITIES = {
  fiche: 'Lecture de fiche',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  cas: 'Cas pratique',
  examen: 'Examen blanc',
};
const CYCLE = ['fiche', 'quiz', 'flashcards', 'quiz', 'cas'];
export const MIN_SLOT = 25;
export const MAX_SLOT = 90;
export const MAX_HORIZON_DAYS = 240;

export function toISODate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function parseISODate(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Poids d'une matière selon le niveau déclaré (1 = débutant … 5 = expert).
 * Une matière faible reçoit environ 3 fois plus de temps qu'une matière maîtrisée.
 */
export function subjectWeight(level) {
  const l = Math.min(5, Math.max(1, Number(level) || 3));
  return 6 - l + 0.5;
}

/**
 * Génère le planning.
 * @param {object} p
 * @param {string} p.startDate   AAAA-MM-JJ (premier jour planifié)
 * @param {string} p.examDate    AAAA-MM-JJ
 * @param {Object<string,number>} p.availability  minutes par jour de semaine, clés "0" (dimanche) … "6"
 * @param {Object<string,number>} p.levels   niveau par id de matière
 * @param {Array<{id, chapters: Array<{id}>}>} p.subjects
 * @returns {Array<{date, subject_id, chapter_id, activity, duration_min}>}
 */
export function generatePlan({ startDate, examDate, availability, levels = {}, subjects }) {
  const start = parseISODate(startDate);
  const exam = parseISODate(examDate);
  if (!(exam > start)) throw new Error("La date d'examen doit être postérieure à la date de début.");
  const usable = subjects.filter((s) => s.chapters?.length);
  if (!usable.length) return [];

  const totalDays = Math.min(MAX_HORIZON_DAYS, Math.round((exam - start) / 86_400_000));
  const finalPhaseStart = Math.max(0, totalDays - 14); // deux dernières semaines : examens blancs

  // Répartition pondérée « au plus grand déficit » : chaque séance va à la matière la plus en retard
  const weights = new Map(usable.map((s) => [s.id, subjectWeight(levels[s.id])]));
  const totalWeight = [...weights.values()].reduce((a, b) => a + b, 0);
  const allocated = new Map(usable.map((s) => [s.id, 0]));
  const chapterCursor = new Map(usable.map((s) => [s.id, 0]));
  const activityCursor = new Map(usable.map((s) => [s.id, 0]));
  let allocatedTotal = 0;

  const items = [];
  for (let i = 0; i < totalDays; i++) {
    const day = addDays(start, i);
    let minutes = Number(availability[String(day.getDay())] || 0);
    if (minutes < MIN_SLOT) continue;

    // En phase finale, un jour sur deux commence par un examen blanc si le temps le permet
    if (i >= finalPhaseStart && (i - finalPhaseStart) % 3 === 0 && minutes >= 60) {
      const dur = Math.min(minutes, 120);
      items.push({ date: toISODate(day), subject_id: null, chapter_id: null, activity: 'examen', duration_min: dur });
      minutes -= dur;
    }

    const slots = splitMinutes(minutes);
    for (const dur of slots) {
      let best = null;
      let bestDeficit = -Infinity;
      for (const s of usable) {
        const target = (weights.get(s.id) / totalWeight) * (allocatedTotal + dur);
        const deficit = target - allocated.get(s.id);
        if (deficit > bestDeficit) {
          bestDeficit = deficit;
          best = s;
        }
      }
      // Éviter deux séances consécutives sur la même matière le même jour si possible
      const last = items[items.length - 1];
      if (last && last.date === toISODate(day) && last.subject_id === best.id && usable.length > 1) {
        const alt = usable
          .filter((s) => s.id !== best.id)
          .sort(
            (a, b) =>
              (weights.get(b.id) / totalWeight) * allocatedTotal - allocated.get(b.id) -
              ((weights.get(a.id) / totalWeight) * allocatedTotal - allocated.get(a.id))
          )[0];
        if (alt) best = alt;
      }
      const ci = chapterCursor.get(best.id);
      const ai = activityCursor.get(best.id);
      const chapter = best.chapters[ci % best.chapters.length];
      const activity = CYCLE[ai % CYCLE.length];
      // On passe au chapitre suivant après un cycle complet
      activityCursor.set(best.id, ai + 1);
      if ((ai + 1) % CYCLE.length === 0) chapterCursor.set(best.id, ci + 1);

      items.push({ date: toISODate(day), subject_id: best.id, chapter_id: chapter.id, activity, duration_min: dur });
      allocated.set(best.id, allocated.get(best.id) + dur);
      allocatedTotal += dur;
    }
  }
  return items;
}

/** Découpe un temps disponible en créneaux de 25 à 90 minutes. */
export function splitMinutes(minutes) {
  const m = Math.floor(minutes);
  if (m < MIN_SLOT) return [];
  if (m <= MAX_SLOT) return [m];
  const n = Math.ceil(m / 60);
  const base = Math.floor(m / n);
  const slots = Array(n).fill(base);
  slots[n - 1] += m - base * n;
  return slots.filter((s) => s >= MIN_SLOT);
}

/**
 * Réorganise les séances manquées : toute séance « prevu » antérieure à aujourd'hui
 * est marquée « manque » et une copie est replanifiée dans les jours suivants
 * ayant encore de la capacité (disponibilité + 30 min de tolérance), avant l'examen.
 * @returns {{ missed: Array, rescheduled: Array }} rescheduled : nouvelles séances à créer
 */
export function rescheduleMissed({ items, today, examDate, availability }) {
  const todayStr = toISODate(today);
  const missed = items.filter((it) => it.status === 'prevu' && it.date < todayStr);
  if (!missed.length) return { missed: [], rescheduled: [] };

  const load = new Map();
  for (const it of items) {
    if (it.status === 'manque' || it.date < todayStr) continue;
    load.set(it.date, (load.get(it.date) || 0) + it.duration_min);
  }
  const exam = parseISODate(examDate);
  const rescheduled = [];
  let cursor = parseISODate(todayStr);
  for (const m of missed) {
    if (m.activity === 'examen') continue; // un examen blanc manqué n'est pas reporté automatiquement
    let placed = false;
    for (let guard = 0; guard < 60 && cursor < exam; guard++) {
      const key = toISODate(cursor);
      const capacity = Number(availability[String(cursor.getDay())] || 0) + 30;
      const used = load.get(key) || 0;
      if (capacity - used >= m.duration_min) {
        load.set(key, used + m.duration_min);
        rescheduled.push({ ...m, id: undefined, date: key, status: 'prevu', rescheduled_from: m.id ?? null });
        placed = true;
        break;
      }
      cursor = addDays(cursor, 1);
    }
    if (!placed) break;
  }
  return { missed, rescheduled };
}
