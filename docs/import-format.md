# Importer vos contenus (depuis NotebookLM ou ailleurs)

L'application importe un fichier **JSON** décrivant matières, chapitres, leçons, fiches, questions, cas pratiques, flashcards et examens blancs.
Modèle complet et valide : [`modele-import.json`](modele-import.json).

## Où importer

Connectez-vous avec le compte administrateur → **Administration** → onglet **Importer** :

1. collez le JSON (ou choisissez le fichier) ;
2. cliquez sur **Vérifier** : l'application liste les erreurs éventuelles ou affiche le décompte de ce qui sera importé ;
3. choisissez le mode :
   - **Ajouter** : complète le contenu existant. Une matière dont le `code` existe déjà reçoit les nouveaux chapitres à la suite ;
   - **Remplacer** : supprime *tout* le contenu actuel (dont la démonstration) **et la progression des étudiants**, puis importe. À réserver au premier import du référentiel officiel.

Conseil : importez **une matière ou un chapitre à la fois** en mode *Ajouter* (fichiers plus courts, erreurs plus faciles à corriger).

## Règles du format

| Élément | Champs obligatoires | Remarques |
|---|---|---|
| Matière (`subjects`) | `code`, `title`, `chapters` | `code` court et unique (ex. `CF`) |
| Chapitre | `key`, `title` | `key` : identifiant libre, unique dans le fichier, utilisé par le champ `chapter` des autres éléments |
| Leçon (`lessons`) | `chapter`, `title`, `content` | |
| Fiche (`sheets`) | `chapter`, `title`, `sections` | `kind` d'une section : `definition`, `regle`, `formule`, `methode`, `exemple`, `erreur` |
| Question (`questions`) | `chapter`, `type`, `prompt` | `difficulty` 1 à 3 ; `diagnostic: true` pour l'inclure au diagnostic initial |
| Cas pratique (`exercises`) | `chapter`, `title`, `statement`, `items` | chaque item : `prompt`, `solution`, `points` (+ `hints`, `criteria`) |
| Flashcard (`flashcards`) | `chapter`, `front`, `back` | |
| Examen blanc (`exams`) | `title`, `duration_min`, `config.perSubject` | les questions sont tirées dans la banque à chaque tentative |

Réponses selon le type de question :

- `mcq` : `choices: [{ "label", "correct": true|false, "feedback" }]` (au moins une bonne réponse) ;
- `truefalse` : `answer: { "value": true }` ;
- `short` : `answer: { "accepted": ["réponse", "variante"] }` (casse et accents ignorés) ;
- `calc` : `answer: { "value": 1800000, "tolerance": 1, "unit": "FCFA" }` (ou `relTolerance: 0.01`) ;
- `match` : `answer: { "left": [...], "right": [...], "pairs": [[indexGauche, indexDroite], ...] }`.

## Consigne à coller dans NotebookLM

Ouvrez votre carnet NotebookLM contenant les cours DESCOGEF, puis collez dans le chat (en adaptant la matière et le chapitre) :

```text
À partir UNIQUEMENT des sources de ce carnet, produis un fichier JSON pour l'application de révision DESCOGEF,
pour la matière « Comptabilité financière » (code "CF") et le chapitre « Immobilisations et amortissements »
(clé "cf-immo"). N'invente aucun chiffre, article de loi ou exemple absent des sources ; si une information manque,
omets l'élément plutôt que de la deviner.

Contenu attendu :
- 1 leçon (résumé du cours) ;
- 1 fiche de révision avec des sections de type definition, regle, formule, methode, exemple et erreur ;
- 10 questions variées : QCM (mcq), vrai/faux (truefalse), réponse courte (short), calcul (calc) et
  association (match), avec difficulté 1 à 3, une compétence et une explication de la bonne réponse ;
  marque 2 questions faciles avec "diagnostic": true ;
- 1 cas pratique (exercises) avec énoncé, annexes, 3 questions, indices, corrigé détaillé, points et critères de barème ;
- 8 flashcards (front / back).

Respecte EXACTEMENT cette structure (noms des champs en anglais, textes en français) :
{"subjects":[{"code":"CF","title":"…","chapters":[{"key":"cf-immo","title":"…"}]}],
 "lessons":[{"chapter":"cf-immo","title":"…","content":"…"}],
 "sheets":[{"chapter":"cf-immo","title":"…","summary":"…","sections":[{"kind":"definition","title":"…","body":"…"}],"refs":["…"]}],
 "questions":[
  {"chapter":"cf-immo","type":"mcq","difficulty":1,"competency":"…","prompt":"…","choices":[{"label":"…","correct":true},{"label":"…","feedback":"pourquoi c'est faux"}],"explanation":"…"},
  {"chapter":"cf-immo","type":"truefalse","prompt":"…","answer":{"value":true},"explanation":"…"},
  {"chapter":"cf-immo","type":"short","prompt":"…","answer":{"accepted":["…"]},"explanation":"…"},
  {"chapter":"cf-immo","type":"calc","prompt":"…","answer":{"value":1800000,"tolerance":1,"unit":"FCFA"},"explanation":"…"},
  {"chapter":"cf-immo","type":"match","prompt":"…","answer":{"left":["…","…"],"right":["…","…"],"pairs":[[0,1],[1,0]]},"explanation":"…"}],
 "exercises":[{"chapter":"cf-immo","kind":"cas","title":"…","statement":"…","duration_min":45,"difficulty":2,
   "annexes":[{"title":"…","table":{"head":["…","…"],"rows":[["…","…"]]}}],
   "items":[{"prompt":"…","hints":["…"],"solution":"…","points":5,"criteria":["…"]}]}],
 "flashcards":[{"chapter":"cf-immo","front":"…","back":"…"}]}

Réponds uniquement avec le JSON, sans texte avant ni après.
```

Copiez la réponse, puis importez-la (mode **Ajouter**). Pour le chapitre suivant, gardez le même `code` de matière et changez la clé de chapitre (ex. `cf-provisions`).

Après import, faites relire les contenus par un enseignant : les éléments importés ne portent pas la mention « démonstration », sauf si vous cochez l'option correspondante.
