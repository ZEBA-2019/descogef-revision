/**
 * Recommandation de la prochaine activité la plus utile.
 * Ordre de priorité : diagnostic, séance du jour, flashcards en retard, notion faible,
 * chapitre jamais travaillé, examen blanc, puis entraînement libre.
 */
export function recommendNext({ diagnosticDone, dueFlashcards = 0, weak = [], untouched = [], todayPlan = [], examReady = false }) {
  if (!diagnosticDone) {
    return { type: 'diagnostic', title: 'Faire le diagnostic initial', reason: 'Il permet de personnaliser vos séances.', to: '/diagnostic' };
  }
  const pending = todayPlan.find((p) => p.status === 'prevu');
  if (pending) {
    return { type: 'plan', title: `Séance du jour : ${pending.label}`, reason: 'Prévue dans votre planning aujourd’hui.', item: pending, to: '/planning' };
  }
  if (dueFlashcards >= 5) {
    return { type: 'flashcards', title: `Réviser ${dueFlashcards} flashcards`, reason: 'Ces cartes arrivent à échéance : les revoir maintenant limite l’oubli.', to: '/flashcards' };
  }
  if (weak.length) {
    const w = weak[0];
    return { type: 'quiz', title: `Renforcer : ${w.title}`, reason: `Maîtrise estimée à ${Math.round(w.mastery * 100)} %.`, chapterId: w.chapterId, to: `/quiz?chapitre=${w.chapterId}` };
  }
  if (untouched.length) {
    const u = untouched[0];
    return { type: 'quiz', title: `Découvrir : ${u.title}`, reason: 'Chapitre pas encore travaillé.', chapterId: u.chapterId, to: `/quiz?chapitre=${u.chapterId}` };
  }
  if (dueFlashcards > 0) {
    return { type: 'flashcards', title: `Réviser ${dueFlashcards} flashcards`, reason: 'Quelques cartes sont à revoir.', to: '/flashcards' };
  }
  if (examReady) {
    return { type: 'examen', title: 'Passer un examen blanc', reason: 'Vos chapitres sont tous entamés : testez-vous en conditions réelles.', to: '/examens' };
  }
  return { type: 'quiz', title: 'Série d’entraînement', reason: 'Consolidez vos acquis avec une série mixte.', to: '/quiz' };
}
