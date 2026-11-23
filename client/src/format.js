export const fmtNumber = (n, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n ?? 0);
export const fmtPercent = (ratio, d = 0) => (ratio == null ? '—' : `${fmtNumber(ratio * 100, d)} %`);
export function fmtDuration(sec) {
  const s = Math.round(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m) return `${m} min`;
  return `${s} s`;
}
export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
export function fmtDate(iso, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!iso) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
  return new Intl.DateTimeFormat('fr-FR', opts).format(d);
}
export const fmtDateShort = (iso) => fmtDate(iso, { day: 'numeric', month: 'short' });
export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const t = new Date(isoDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((t - now) / 86_400_000);
}
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const KIND_LABELS = { quiz: 'Quiz', diagnostic: 'Diagnostic', examen: 'Examen blanc', cas: 'Cas pratique' };
export const TYPE_LABELS = { mcq: 'QCM', truefalse: 'Vrai / Faux', short: 'Réponse courte', calc: 'Calcul', match: 'Association' };
export const DIFFICULTY_LABELS = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' };
export const STATUS_LABELS = { a_decouvrir: 'À découvrir', en_cours: 'En cours', maitrise: 'Maîtrisé' };
