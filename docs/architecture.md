# Architecture et modèle de données

## Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Serveur | Node.js + Express | Simple, répandu, facile à héberger |
| Base persistante | SQLite via `node:sqlite` (intégré à Node 22) | Aucune installation ni compilation ; un seul fichier à sauvegarder |
| Validation | zod | Schémas déclaratifs, messages en français |
| Interface | React 18 + React Router + Vite | Pages découpées et chargées à la demande |
| Logique métier | Modules purs dans `shared/` | Testables sans base ni serveur |

## Entités

| Entité demandée | Table | Remarques |
|---|---|---|
| Utilisateur | `users` (+ `auth_sessions`) | `role` = `etudiant` / `admin`, `levels` (niveau déclaré par matière), `exam_date`, `settings` (thème) |
| Matière | `subjects` | `position` pour le classement, `is_demo` |
| Chapitre | `chapters` | rattaché à une matière |
| Leçon | `lessons` | contenu de cours d’un chapitre |
| Fiche | `sheets` | `sections` JSON `[{kind, title, body}]`, `refs` (références) |
| Question | `questions` | `type` ∈ mcq, truefalse, short, calc, match ; `difficulty` 1-3 ; `competency` ; `answer` JSON ; `is_diagnostic` |
| Choix de réponse | `choices` | pour les QCM, avec `feedback` par choix |
| Exercice / Cas pratique | `exercises` | `kind` ∈ exercice, cas ; `annexes` et `items` JSON (question, indices, corrigé, points, critères de barème) |
| Flashcard | `flashcards` | état SRS par utilisateur dans `flashcard_states` |
| Examen blanc | `exams` | modèle : durée, nombre de questions par matière, mélange de difficultés |
| Tentative | `attempts` | `kind` ∈ quiz, diagnostic, examen, cas ; `state` JSON (questions tirées, réponses sauvegardées, échéance) ; note /20 |
| Résultat | `results` | **une ligne par réponse** : réponse, correct, score 0-1, temps passé, difficulté, compétence, matière, chapitre |
| Séance de révision | `study_sessions` | temps passé par activité (quiz, fiche, flashcards, cas, examen) |
| Planning | `plans` + `plan_items` | paramètres + séances datées (`prevu`, `fait`, `manque`, `rescheduled_from`) |
| Note personnelle | `notes` | par utilisateur et par fiche |
| Favori | `favorites` | par utilisateur et par fiche ; statut de fiche dans `sheet_status` |

## Règles de calcul

### Note d’une série (`shared/scoring.js`)
Chaque réponse vaut un score entre 0 et 1 (crédit partiel pour les associations), pondéré par la difficulté (facile ×1, moyen ×1,5, difficile ×2). Note /20 = points / points maximum × 20.

### Maîtrise et progression (`shared/progress.js`)
- **Maîtrise d’un chapitre** : moyenne des scores pondérée par la difficulté et par la récence (chaque réponse plus ancienne pèse 15 % de moins).
- **Confiance** : min(1, nombre de réponses / 6).
- **Progression d’un chapitre** = 75 % × maîtrise × confiance + 25 % × part des fiches maîtrisées (une fiche « En cours » compte pour moitié).
- **Matière** = moyenne de ses chapitres ; **globale** = moyenne des matières.
- **Notions à revoir** : chapitres de maîtrise < 60 %, triés par (1 − maîtrise) × (0,5 + 0,5 × confiance).

### Personnalisation
- **Quiz adaptatif** : priorité aux chapitres de faible maîtrise, aux questions ratées la dernière fois et aux questions jamais vues ; les questions réussies dans les 24 h sont repoussées.
- **Recommandation** (`shared/recommend.js`) : diagnostic → séance du jour du planning → flashcards en retard (≥ 5) → notion la plus faible → chapitre jamais travaillé → examen blanc (si chaque chapitre compte ≥ 3 réponses et la progression ≥ 40 %).

### Répétition espacée (`shared/srs.js`)
Variante de SM-2 à quatre notes. « À revoir » : réapprentissage dans 10 minutes et facilité −0,2. « Difficile » : intervalle ×1,2 et facilité −0,15. « Correct » : intervalle × facilité. « Facile » : intervalle × facilité × 1,3 et facilité +0,15. Les cartes en retard passent en tête, d’autant plus qu’elles ont été souvent oubliées.

### Planning (`shared/planner.js`)
Chaque matière reçoit un poids (6 − niveau + 0,5) ; chaque créneau (25 à 90 min) est attribué à la matière la plus en retard sur sa part cible. Les activités tournent (fiche → quiz → flashcards → quiz → cas) chapitre par chapitre ; les deux dernières semaines intègrent des examens blancs. À chaque consultation, les séances passées non faites sont marquées « manquées » et reportées sur les jours suivants ayant de la capacité (disponibilité + 30 min de tolérance).
