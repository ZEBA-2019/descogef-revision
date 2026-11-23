# DESCOGEF Révision

Application web de révision destinée aux candidats au **DESCOGEF** (Diplôme d’Études Supérieures de Comptabilité et Gestion Financière) dans l’espace OHADA/UEMOA.

> ⚠️ **Contenu de démonstration.** Les matières, fiches, questions, cas pratiques et flashcards fournis sont **fictifs**. Ils ne constituent pas le référentiel officiel du DESCOGEF : ils doivent être **validés par un enseignant ou remplacés** par le programme officiel (voir [Remplacer le contenu](#remplacer-le-contenu-de-démonstration)). Chaque élément de démonstration porte le drapeau `is_demo` et un bandeau l’indique dans l’interface.

## Fonctionnalités

| Module | Ce qui est disponible |
|---|---|
| **Inscription / connexion** | Comptes étudiants, mots de passe hachés (scrypt), sessions par cookie `httpOnly`, rôle administrateur |
| **Diagnostic initial** | Date d’examen, niveau ressenti par matière, 9 questions couvrant les chapitres, bilan |
| **Tableau de bord** | Progression générale et par matière, temps de révision, taux de réussite, jours consécutifs, séries récentes, notions à revoir, séance du jour, bouton **« Réviser maintenant »** |
| **Programme** | Matières → chapitres → leçons, fiches, quiz et cas, avec progression |
| **Fiches** | Sections typées (définition, règle, formule, méthode, exemple, erreurs fréquentes), références, favoris, notes personnelles (sauvegarde auto), statut « À découvrir / En cours / Maîtrisé », mode lecture et mode **mémorisation** (masquage progressif) |
| **Quiz** | QCM (une ou plusieurs réponses), vrai/faux, réponse courte, calcul (formats « 1 234,56 » acceptés, tolérance), association ; correction et explication **immédiates** ; filtres matière / chapitre / difficulté / type ; séries de 5, 10, 20 ou 40 ; mode adaptatif |
| **Cas pratiques** | Énoncé, annexes (tableaux), réponse libre ou étape par étape, indices progressifs, corrigé détaillé, barème, autoévaluation, mode chronométré |
| **Flashcards** | Recto/verso, notes « À revoir / Difficile / Correct / Facile », répétition espacée (SM-2 adapté), priorité aux cartes oubliées, raccourcis clavier (Espace, 1-4) |
| **Examens blancs** | Sujet équilibré tiré à chaque tentative, chronomètre, navigation libre, sauvegarde automatique (10 s + changement d’onglet), reprise, remise automatique à la fin du temps, note, corrigé, compétences à renforcer, historique |
| **Planning** | Date d’examen, disponibilités hebdomadaires, niveau par matière → programme réaliste ; plus de temps sur les matières faibles ; examens blancs en fin de parcours ; **report automatique des séances manquées** ; vues jour / semaine / mois |
| **Statistiques** | Courbe des scores, comparaison par matière et chapitre, réussite par difficulté, erreurs récurrentes par compétence, questions les plus manquées, temps par activité, prochaine activité recommandée |
| **Profil** | Nom, date d’examen, thème clair / sombre / système, mot de passe, export des données (JSON), réinitialisation |
| **Administration** | CRUD et classement (↑ ↓) des matières, chapitres, leçons, fiches, questions (+ choix), exercices / cas, flashcards et modèles d’examen ; validation serveur |

Interface entièrement en français, responsive (ordinateur et téléphone), utilisable au clavier (lien d’évitement, focus visible, libellés ARIA), mode sombre, graphiques accompagnés de tableaux pour les lecteurs d’écran, animations désactivées si `prefers-reduced-motion`.

## Prérequis

- **Node.js 22.13 ou plus récent** (le module intégré `node:sqlite` est utilisé : aucune base externe ni compilation native n’est nécessaire).
- npm 10+.

## Installation et lancement

```bash
npm install
```

### Développement (rechargement à chaud)

```bash
npm run dev
```

- Interface : http://localhost:5173 (Vite, qui relaie `/api` vers le serveur)
- API : http://localhost:3001

### Production

```bash
npm run build
```

```bash
ADMIN_PASSWORD='un-mot-de-passe-solide' npm start
```

L’application complète (API + interface compilée) est alors servie sur http://localhost:3001.

Au **premier lancement**, la base SQLite est créée (`data/descogef.db`), le contenu de démonstration est chargé et un compte administrateur est créé (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). **Changez ce mot de passe** depuis « Profil et paramètres ».

### Configuration

Variables d’environnement (voir `.env.example`) :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port HTTP |
| `DATABASE_PATH` | `./data/descogef.db` | Fichier SQLite (`:memory:` pour les tests) |
| `ADMIN_EMAIL` | `admin@descogef.local` | Compte administrateur initial |
| `ADMIN_PASSWORD` | `ChangezMoi-2026!` | Mot de passe initial — à définir en production |
| `SESSION_DAYS` | `30` | Durée des sessions |
| `APP_ORIGIN` | — | Origine supplémentaire autorisée pour les requêtes modifiantes |
| `NODE_ENV` | — | `production` active le cookie `Secure` et la CSP |

En production, placez l’application derrière un proxy HTTPS (le cookie de session est alors `Secure`).

### Tests

```bash
npm test
```

39 tests (runner intégré `node:test`) :

- `tests/scoring.test.js` — correction de chaque type de question, saisie numérique française, score pondéré par la difficulté ;
- `tests/progress.test.js` — maîtrise pondérée par la récence, progression chapitre / matière / globale, lacunes, erreurs récurrentes, série de jours, recommandations ;
- `tests/srs.test.js` — répétition espacée (intervalles, facilité, oublis, priorité de la file) ;
- `tests/planner.test.js` — génération du planning, respect des disponibilités, pondération par niveau, report des séances manquées ;
- `tests/api-flow.test.js` — intégration HTTP sur base en mémoire : **inscription → diagnostic → tableau de bord → quiz → correction → mise à jour de la progression**, non-divulgation des réponses, contrôle d’accès, administration, examen blanc (sauvegarde, reprise, remise automatique), flashcards, planning, cas pratique.

## Remplacer le contenu de démonstration

Deux possibilités :

1. **Par l’interface** : se connecter avec le compte administrateur → **Administration**. Modifier ou supprimer chaque élément et décocher « Contenu de démonstration » une fois validé. Un compteur rappelle le nombre d’éléments encore en démo.
2. **Par fichier** : éditer `server/seed/demo-content.js` (même structure), puis :
   ```bash
   npm run seed:reset
   ```
   ⚠️ `seed:reset` supprime tout le contenu pédagogique **et la progression des utilisateurs** liée à ce contenu (les comptes sont conservés).

## Architecture

```
shared/            Logique métier pure, testée (aucune E/S)
  scoring.js       Correction des réponses, notes /20
  progress.js      Maîtrise, progression, lacunes, erreurs récurrentes
  srs.js           Répétition espacée
  planner.js       Génération et réorganisation du planning
  recommend.js     Prochaine activité recommandée
server/
  app.js           Application Express (sécurité, routes, interface compilée)
  index.js         Démarrage (initialisation de la base + contenu de démo)
  db.js            Accès SQLite (node:sqlite), transactions
  schema.sql       Schéma de la base
  auth.js          Hachage scrypt, sessions, contrôle d’accès, limitation de débit
  services.js      Requêtes et orchestration (progression, tableau de bord, statistiques)
  routes/          auth, quiz (quiz, diagnostic, examens), content (programme, fiches,
                   flashcards, cas), planning (+ tableau de bord, stats), admin
  seed/            Contenu de démonstration
client/            Interface React (Vite, React Router), une page par écran
tests/             Tests unitaires et d’intégration
docs/              Modèle de données et choix techniques
```

Le détail du modèle de données et des règles de calcul est dans [`docs/architecture.md`](docs/architecture.md).

## Sécurité

- Mots de passe hachés avec **scrypt** et sel aléatoire ; comparaison à temps constant.
- Session : jeton aléatoire de 256 bits en cookie `httpOnly`, `SameSite=Lax` (`Secure` en production) ; seul le **hachage** du jeton est stocké.
- Protection CSRF : `SameSite` + vérification de l’en-tête `Origin` sur les requêtes modifiantes.
- Limitation des tentatives de connexion / inscription.
- Validation de toutes les entrées avec **zod** ; requêtes SQL paramétrées.
- Les bonnes réponses, explications, indices et corrigés ne sont **jamais envoyés avant** la réponse de l’étudiant.
- En-têtes de sécurité (CSP en production, `X-Frame-Options`, `nosniff`, etc.).
- Routes d’administration réservées au rôle `admin`.

## Limites connues de cette première version

- Les cas pratiques sont corrigés par **autoévaluation** (pas de correction automatique de texte libre).
- Pas de réinitialisation de mot de passe par e-mail (nécessiterait un service d’envoi).
- SQLite convient à un établissement ou à quelques centaines d’utilisateurs ; pour davantage, migrer `server/db.js` vers PostgreSQL (le SQL est standard).
- Le limiteur de débit est en mémoire (une seule instance).
