// Applique le thème avant l'affichage pour éviter un flash de couleur.
try {
  var t = localStorage.getItem('dsg-theme');
  if (t === 'sombre' || (t !== 'clair' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark';
} catch (e) {}
