/** Thème : 'clair' | 'sombre' | 'systeme'. Mémorisé localement pour éviter le flash au chargement. */
export function applyTheme(theme) {
  try {
    localStorage.setItem('dsg-theme', theme);
  } catch {
    /* stockage indisponible */
  }
  const dark = theme === 'sombre' || (theme !== 'clair' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
}
export function currentTheme() {
  try {
    return localStorage.getItem('dsg-theme') || 'systeme';
  } catch {
    return 'systeme';
  }
}
