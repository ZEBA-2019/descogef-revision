/**
 * CONTENU DE DÉMONSTRATION
 * ------------------------------------------------------------------
 * Ces données sont FICTIVES et servent uniquement à faire fonctionner l'application.
 * Elles ne constituent PAS le référentiel officiel du DESCOGEF et doivent être
 * validées par un enseignant ou remplacées par le programme officiel
 * (via l'espace d'administration ou en modifiant ce fichier puis `npm run seed:reset`).
 *
 * Les montants sont exprimés en FCFA. Les entreprises citées sont imaginaires.
 * Le taux de TVA de 18 % est retenu à titre d'exemple : il varie selon les États.
 */

export const DEMO_NOTICE =
  'Contenu de démonstration : à faire valider par un enseignant ou à remplacer par le référentiel officiel du DESCOGEF.';

export const subjects = [
  {
    code: 'CF',
    title: 'Comptabilité financière approfondie',
    description: 'Référentiel SYSCOHADA révisé : organisation comptable, immobilisations, dépréciations et provisions. (Démo)',
    chapters: [
      { key: 'cf1', title: 'Cadre conceptuel et organisation comptable', description: 'Plan de comptes, classes, activités ordinaires et HAO.' },
      { key: 'cf2', title: 'Immobilisations et amortissements', description: 'Coût d’entrée, durée d’utilité, amortissement, cession.' },
      { key: 'cf3', title: 'Dépréciations et provisions', description: 'Dépréciation des créances, provisions pour risques et charges.' },
    ],
  },
  {
    code: 'CG',
    title: 'Contrôle de gestion',
    description: 'Calcul des coûts, analyse coût-volume-profit, gestion budgétaire et écarts. (Démo)',
    chapters: [
      { key: 'cg1', title: 'Coûts complets et centres d’analyse', description: 'Charges directes et indirectes, unités d’œuvre.' },
      { key: 'cg2', title: 'Coûts partiels et seuil de rentabilité', description: 'Marge sur coût variable, point mort, marge de sécurité.' },
      { key: 'cg3', title: 'Gestion budgétaire et analyse des écarts', description: 'Budgets, écarts sur charges directes.' },
    ],
  },
  {
    code: 'FE',
    title: 'Finance d’entreprise',
    description: 'Analyse financière, choix d’investissement, coût du capital. (Démo)',
    chapters: [
      { key: 'fe1', title: 'Analyse fonctionnelle du bilan', description: 'Fonds de roulement, BFR, trésorerie nette.' },
      { key: 'fe2', title: 'Choix d’investissement', description: 'VAN, TRI, délai de récupération.' },
      { key: 'fe3', title: 'Coût du capital et financement', description: 'CMPC, effet de levier.' },
    ],
  },
];

export const lessons = [
  { chapter: 'cf1', title: 'Les classes du plan de comptes', content: 'Le plan de comptes est organisé en classes : 1 à 5 pour les comptes de bilan, 6 et 7 pour les charges et produits des activités ordinaires, 8 pour les comptes des autres charges et produits (HAO notamment), 9 pour la comptabilité analytique de gestion.' },
  { chapter: 'cf2', title: 'Comptabiliser une immobilisation', content: 'Une immobilisation corporelle est enregistrée à son coût d’entrée (prix d’achat, frais directement attribuables). Elle est amortie sur sa durée d’utilité, à partir de sa date de mise en service.' },
  { chapter: 'cf3', title: 'Dépréciation ou provision ?', content: 'Une dépréciation constate la perte de valeur d’un actif. Une provision pour risques et charges constate un passif dont l’échéance ou le montant est incertain.' },
  { chapter: 'cg1', title: 'La méthode des centres d’analyse', content: 'Les charges indirectes sont réparties entre centres (répartition primaire puis secondaire), puis imputées aux coûts selon le nombre d’unités d’œuvre consommées.' },
  { chapter: 'cg2', title: 'Le raisonnement coût-volume-profit', content: 'En séparant charges variables et charges fixes, on mesure la marge sur coût variable et l’on détermine le chiffre d’affaires minimal pour couvrir les charges fixes.' },
  { chapter: 'cg3', title: 'Pourquoi analyser les écarts ?', content: 'Comparer le réalisé au prévisionnel permet d’identifier les causes de dérive (prix, quantités, rendement) et de désigner les responsables des actions correctrices.' },
  { chapter: 'fe1', title: 'La logique du bilan fonctionnel', content: 'Le bilan fonctionnel classe emplois et ressources selon les cycles : investissement, financement, exploitation, hors exploitation et trésorerie.' },
  { chapter: 'fe2', title: 'Actualiser les flux', content: 'Un franc disponible aujourd’hui vaut plus qu’un franc disponible demain : les flux futurs sont actualisés au taux de rentabilité exigé.' },
  { chapter: 'fe3', title: 'Le coût des ressources', content: 'Le coût moyen pondéré du capital (CMPC) mesure la rentabilité minimale exigée par l’ensemble des apporteurs de fonds.' },
];

export const sheets = [
  {
    chapter: 'cf2',
    title: 'Immobilisations corporelles et amortissement',
    summary: 'Évaluer une immobilisation à l’entrée, calculer la dotation et traiter une cession.',
    sections: [
      { kind: 'definition', title: 'Immobilisation corporelle', body: 'Actif physique détenu pour être utilisé dans la production, la fourniture de biens ou de services ou à des fins administratives, et dont l’entité prévoit l’utilisation sur plus d’un exercice.' },
      { kind: 'definition', title: 'Durée d’utilité', body: 'Période pendant laquelle l’entité s’attend à utiliser l’actif. Elle peut être différente de la durée de vie physique du bien.' },
      { kind: 'regle', title: 'Point de départ', body: 'L’amortissement commence à la date de mise en service (prorata temporis). Les terrains, sauf exceptions (gisements, carrières…), ne sont pas amortis.' },
      { kind: 'formule', title: 'Amortissement linéaire', body: 'Dotation annuelle = Base amortissable ÷ Durée d’utilité\nDotation de la 1re année = Dotation annuelle × (nombre de mois d’utilisation ÷ 12)' },
      { kind: 'formule', title: 'Résultat de cession', body: 'VCN = Coût d’entrée − Amortissements cumulés (y compris la dotation complémentaire jusqu’à la date de cession)\nPlus ou moins-value = Prix de cession − VCN' },
      { kind: 'methode', title: 'Traiter une cession en 3 temps', body: '1. Constater la dotation complémentaire jusqu’à la date de cession.\n2. Sortir le bien : constater sa VCN en charge HAO (compte 81) et solder l’amortissement.\n3. Enregistrer le prix de cession en produit HAO (compte 82).' },
      { kind: 'exemple', title: 'Exemple chiffré', body: 'Matériel acquis 12 000 000 FCFA, durée d’utilité 5 ans, mis en service le 1er avril N.\nDotation annuelle : 12 000 000 ÷ 5 = 2 400 000.\nDotation N : 2 400 000 × 9/12 = 1 800 000.' },
      { kind: 'erreur', title: 'Erreurs fréquentes', body: '• Oublier le prorata temporis la première année.\n• Calculer la VCN sans la dotation complémentaire de l’année de cession.\n• Amortir un terrain nu.' },
    ],
    refs: ['Acte uniforme relatif au droit comptable et à l’information financière (AUDCIF) — à vérifier', 'Guide d’application du SYSCOHADA révisé — chapitre immobilisations (référence à préciser)'],
  },
  {
    chapter: 'cf3',
    title: 'Dépréciations et provisions',
    summary: 'Distinguer dépréciation d’actif et provision pour risques et charges ; calculer la dépréciation d’une créance.',
    sections: [
      { kind: 'definition', title: 'Dépréciation', body: 'Constatation de la diminution de la valeur d’un élément d’actif (stocks, créances, titres, immobilisations).' },
      { kind: 'definition', title: 'Provision pour risques et charges', body: 'Passif dont l’échéance ou le montant n’est pas fixé de façon précise.' },
      { kind: 'regle', title: 'Conditions de la provision', body: 'Obligation (légale, contractuelle ou implicite) à la clôture, sortie de ressources probable sans contrepartie au moins équivalente, montant estimable de manière fiable.' },
      { kind: 'formule', title: 'Dépréciation d’une créance', body: 'Dépréciation = Créance HT × Pourcentage de perte probable\n(la TVA collectée reste récupérable en cas de perte définitive, selon la législation applicable)' },
      { kind: 'exemple', title: 'Exemple', body: 'Créance de 2 360 000 FCFA TTC (TVA 18 %), perte probable 40 %.\nHT = 2 360 000 ÷ 1,18 = 2 000 000.\nDépréciation = 2 000 000 × 40 % = 800 000.' },
      { kind: 'erreur', title: 'Erreurs fréquentes', body: '• Calculer la dépréciation sur le TTC.\n• Confondre provision (passif) et dépréciation (correction d’actif).\n• Oublier l’ajustement (dotation complémentaire ou reprise) à la clôture suivante.' },
    ],
    refs: ['SYSCOHADA révisé — comptes 19, 29, 39, 49, 59 (à vérifier)'],
  },
  {
    chapter: 'cg2',
    title: 'Seuil de rentabilité et marge de sécurité',
    summary: 'Utiliser le compte de résultat différentiel pour déterminer le point mort.',
    sections: [
      { kind: 'definition', title: 'Marge sur coût variable (MCV)', body: 'Chiffre d’affaires − Charges variables. Elle doit couvrir les charges fixes et dégager le résultat.' },
      { kind: 'definition', title: 'Seuil de rentabilité (SR)', body: 'Chiffre d’affaires pour lequel le résultat est nul : MCV = Charges fixes.' },
      { kind: 'formule', title: 'Formules clés', body: 'Taux de MCV = MCV ÷ CA\nSR = Charges fixes ÷ Taux de MCV\nMarge de sécurité = CA − SR\nIndice de sécurité = Marge de sécurité ÷ CA\nPoint mort (en jours) = SR ÷ CA × 360' },
      { kind: 'methode', title: 'Méthode', body: '1. Reclasser les charges en variables et fixes.\n2. Bâtir le compte de résultat différentiel.\n3. Calculer le taux de MCV puis le SR.\n4. Interpréter : marge de sécurité, date du point mort.' },
      { kind: 'exemple', title: 'Exemple', body: 'CA 50 000 000 ; charges variables 30 000 000 ; charges fixes 12 000 000.\nTaux de MCV = 20 000 000 ÷ 50 000 000 = 40 %.\nSR = 12 000 000 ÷ 0,40 = 30 000 000.\nPoint mort = 30/50 × 360 = 216 jours.' },
      { kind: 'erreur', title: 'Erreurs fréquentes', body: '• Diviser les charges fixes par la MCV en valeur au lieu du taux.\n• Oublier l’hypothèse d’activité régulière pour dater le point mort.\n• Classer une charge semi-variable entièrement en fixe.' },
    ],
    refs: ['Programme de contrôle de gestion — à compléter avec le référentiel officiel'],
  },
  {
    chapter: 'cg3',
    title: 'Écarts sur charges directes',
    summary: 'Décomposer l’écart global sur matières en écart sur prix et écart sur quantité.',
    sections: [
      { kind: 'definition', title: 'Écart global', body: 'Coût réel − Coût préétabli de la production réelle.' },
      { kind: 'formule', title: 'Décomposition', body: 'Écart sur prix = (Prix réel − Prix préétabli) × Quantité réelle\nÉcart sur quantité = (Quantité réelle − Quantité préétablie) × Prix préétabli\nÉcart global = Écart sur prix + Écart sur quantité' },
      { kind: 'regle', title: 'Lecture du signe', body: 'Pour une charge, un écart positif est défavorable (on a dépensé plus que prévu) ; un écart négatif est favorable.' },
      { kind: 'exemple', title: 'Exemple', body: 'Prévu pour la production réelle : 1 000 kg à 500 F. Réel : 1 100 kg à 520 F.\nÉcart sur prix = 20 × 1 100 = 22 000 (défavorable).\nÉcart sur quantité = 100 × 500 = 50 000 (défavorable).\nÉcart global = 572 000 − 500 000 = 72 000 (défavorable).' },
      { kind: 'erreur', title: 'Erreurs fréquentes', body: '• Comparer au budget initial plutôt qu’au coût préétabli de la production réelle.\n• Inverser les quantités utilisées dans l’écart sur prix.' },
    ],
    refs: ['À compléter avec le référentiel officiel'],
  },
  {
    chapter: 'fe1',
    title: 'Bilan fonctionnel : FR, BFR et trésorerie nette',
    summary: 'Mesurer l’équilibre financier à partir du bilan fonctionnel.',
    sections: [
      { kind: 'definition', title: 'Fonds de roulement (FR)', body: 'Excédent des ressources stables sur les emplois stables. Il finance une partie du cycle d’exploitation.' },
      { kind: 'definition', title: 'Besoin de financement global (BFR)', body: 'Actif circulant (hors trésorerie) − Passif circulant (hors trésorerie). Il naît des décalages entre flux physiques et flux financiers.' },
      { kind: 'formule', title: 'Relation fondamentale', body: 'FR = Ressources stables − Emplois stables\nBFR = BFE + BFHAO\nTN = FR − BFR = Trésorerie actif − Trésorerie passif' },
      { kind: 'methode', title: 'Interpréter', body: 'TN > 0 : le FR couvre le BFR, l’entreprise dégage un excédent de trésorerie.\nTN < 0 : le BFR est en partie financé par des concours bancaires courants : vigilance.' },
      { kind: 'exemple', title: 'Exemple', body: 'Ressources stables 80 M ; emplois stables 65 M → FR = 15 M.\nBFR = 18 M → TN = −3 M.' },
      { kind: 'erreur', title: 'Erreurs fréquentes', body: '• Oublier de vérifier l’égalité TN = Trésorerie actif − Trésorerie passif.\n• Classer les concours bancaires courants en ressources stables.' },
    ],
    refs: ['À compléter avec le référentiel officiel'],
  },
  {
    chapter: 'fe2',
    title: 'VAN, TRI et délai de récupération',
    summary: 'Évaluer la rentabilité d’un projet d’investissement.',
    sections: [
      { kind: 'formule', title: 'Valeur actuelle nette', body: 'VAN = Σ Flux nets de trésorerie × (1 + t)^−n − Investissement initial\nAnnuités constantes : VAN = a × [1 − (1 + t)^−n] ÷ t − I₀' },
      { kind: 'definition', title: 'Taux de rentabilité interne (TRI)', body: 'Taux d’actualisation qui annule la VAN.' },
      { kind: 'regle', title: 'Critères de décision', body: 'Projet acceptable si VAN > 0, soit TRI > taux exigé. Entre projets exclusifs, privilégier la VAN la plus élevée (à durée et taille comparables).' },
      { kind: 'exemple', title: 'Exemple', body: 'I₀ = 10 000 000 ; flux 4 200 000 pendant 3 ans ; t = 10 %.\nFacteur = 2,486852 → VAN = 10 444 778 − 10 000 000 = 444 778.' },
      { kind: 'erreur', title: 'Erreurs fréquentes', body: '• Actualiser des résultats comptables au lieu des flux de trésorerie.\n• Oublier la récupération du BFR ou la valeur résiduelle en fin de projet.' },
    ],
    refs: ['À compléter avec le référentiel officiel'],
  },
];

/* ------------------------------------------------------------------ */
/* Questions : 30 (10 par matière). diagnostic: true = utilisée dans le diagnostic initial. */
/* ------------------------------------------------------------------ */
const mcq = (chapter, prompt, choices, extra) => ({ chapter, type: 'mcq', prompt, choices, ...extra });

export const questions = [
  // ---------- Comptabilité financière ----------
  mcq('cf1', 'Dans le plan de comptes SYSCOHADA révisé, la classe 6 regroupe :', [
    { label: 'Les comptes de charges des activités ordinaires', correct: true },
    { label: 'Les comptes de produits des activités ordinaires', feedback: 'Ce sont les comptes de la classe 7.' },
    { label: 'Les comptes de trésorerie', feedback: 'La trésorerie correspond à la classe 5.' },
    { label: 'Les comptes de tiers', feedback: 'Les comptes de tiers correspondent à la classe 4.' },
  ], { difficulty: 1, competency: 'Plan de comptes', diagnostic: true, explanation: 'Classes 6 et 7 : charges et produits des activités ordinaires ; classe 8 : autres charges et produits (dont HAO).' }),
  { chapter: 'cf1', type: 'truefalse', prompt: 'Le SYSCOHADA révisé distingue les opérations des activités ordinaires (classes 6 et 7) des opérations hors activités ordinaires (HAO), enregistrées en classe 8.', answer: { value: true }, difficulty: 1, competency: 'Plan de comptes', explanation: 'Les opérations HAO (cessions d’immobilisations, opérations exceptionnelles…) figurent en classe 8.' },
  { chapter: 'cf1', type: 'match', prompt: 'Associez chaque classe à son contenu.', answer: { left: ['Classe 1', 'Classe 2', 'Classe 3', 'Classe 5'], right: ['Comptes de trésorerie', 'Comptes de ressources durables', 'Comptes d’actif immobilisé', 'Comptes de stocks'], pairs: [[0, 1], [1, 2], [2, 3], [3, 0]] }, difficulty: 1, competency: 'Plan de comptes', explanation: 'Classe 1 : ressources durables ; classe 2 : actif immobilisé ; classe 3 : stocks ; classe 4 : tiers ; classe 5 : trésorerie.' },
  { chapter: 'cf2', type: 'calc', prompt: 'Un matériel acquis 12 000 000 FCFA HT, d’une durée d’utilité de 5 ans, est mis en service le 1er avril N (amortissement linéaire, clôture au 31 décembre). Quelle est la dotation de l’exercice N (en FCFA) ?', answer: { value: 1800000, tolerance: 1, unit: 'FCFA' }, difficulty: 1, competency: 'Amortissement', diagnostic: true, explanation: 'Dotation annuelle = 12 000 000 ÷ 5 = 2 400 000. Prorata de 9 mois : 2 400 000 × 9/12 = 1 800 000.' },
  mcq('cf2', 'Lors de la cession d’une immobilisation corporelle, la valeur comptable nette (VCN) du bien cédé est portée au débit du compte :', [
    { label: '812 — Valeurs comptables des cessions d’immobilisations corporelles', correct: true },
    { label: '822 — Produits des cessions d’immobilisations corporelles', feedback: 'Le compte 82 enregistre le prix de cession (produit HAO).' },
    { label: '681 — Dotations aux amortissements d’exploitation', feedback: 'Ce compte sert à la dotation, pas à la sortie du bien.' },
    { label: '245 — Matériel de transport', feedback: 'Le compte d’immobilisation est crédité lors de la sortie.' },
  ], { difficulty: 2, competency: 'Cession d’immobilisation', explanation: 'La sortie du bien se traduit par une charge HAO (compte 81) pour la VCN ; le prix de cession est un produit HAO (compte 82).' }),
  { chapter: 'cf2', type: 'calc', prompt: 'Un matériel acquis 10 000 000 FCFA, amorti à hauteur de 6 500 000 FCFA à la date de cession, est cédé 4 000 000 FCFA. Quel est le résultat de cession (en FCFA, signe − pour une moins-value) ?', answer: { value: 500000, tolerance: 1, unit: 'FCFA' }, difficulty: 2, competency: 'Cession d’immobilisation', explanation: 'VCN = 10 000 000 − 6 500 000 = 3 500 000. Résultat = 4 000 000 − 3 500 000 = +500 000 (plus-value).' },
  { chapter: 'cf2', type: 'short', prompt: 'Comment appelle-t-on la période pendant laquelle l’entité prévoit d’utiliser un actif ?', answer: { accepted: ['Durée d’utilité', 'duree d utilite', 'la durée d’utilité'] }, difficulty: 1, competency: 'Amortissement', explanation: 'La durée d’utilité est propre à l’entité ; elle peut différer de la durée de vie physique du bien.' },
  { chapter: 'cf2', type: 'truefalse', prompt: 'Un terrain nu fait normalement l’objet d’un amortissement.', answer: { value: false }, difficulty: 1, competency: 'Amortissement', explanation: 'Un terrain ne se déprécie pas par l’usage ; il n’est pas amorti, sauf cas particuliers (terrains de gisement, carrières…).' },
  { chapter: 'cf3', type: 'calc', prompt: 'Une créance client de 2 360 000 FCFA TTC (TVA à 18 %) présente un risque de perte estimé à 40 %. Quel est le montant de la dépréciation à constater (en FCFA) ?', answer: { value: 800000, tolerance: 1, unit: 'FCFA' }, difficulty: 2, competency: 'Dépréciation des créances', diagnostic: true, explanation: 'La dépréciation se calcule sur le HT : 2 360 000 ÷ 1,18 = 2 000 000 ; 2 000 000 × 40 % = 800 000.' },
  mcq('cf3', 'Une provision pour risques et charges doit être constituée lorsque :', [
    { label: 'Il existe une obligation à la clôture, une sortie de ressources probable et un montant estimable de façon fiable', correct: true },
    { label: 'Un actif a perdu de la valeur', feedback: 'Il s’agit alors d’une dépréciation, pas d’une provision.' },
    { label: 'L’entreprise souhaite lisser son résultat', feedback: 'Une provision ne peut pas servir à lisser le résultat.' },
    { label: 'Une dépense future est simplement envisagée', feedback: 'Sans obligation à la clôture, aucune provision n’est permise.' },
  ], { difficulty: 2, competency: 'Provisions', explanation: 'Les trois conditions (obligation, sortie probable, estimation fiable) sont cumulatives.' }),

  // ---------- Contrôle de gestion ----------
  { chapter: 'cg2', type: 'calc', prompt: 'Chiffre d’affaires : 50 000 000 ; charges variables : 30 000 000 ; charges fixes : 12 000 000. Quel est le seuil de rentabilité (en FCFA) ?', answer: { value: 30000000, tolerance: 1, unit: 'FCFA' }, difficulty: 1, competency: 'Seuil de rentabilité', diagnostic: true, explanation: 'Taux de MCV = 20 000 000 ÷ 50 000 000 = 40 %. SR = 12 000 000 ÷ 0,40 = 30 000 000.' },
  mcq('cg2', 'La marge de sécurité correspond à :', [
    { label: 'Chiffre d’affaires − Seuil de rentabilité', correct: true },
    { label: 'Chiffre d’affaires − Charges variables', feedback: 'C’est la marge sur coût variable.' },
    { label: 'Marge sur coût variable − Charges fixes', feedback: 'C’est le résultat.' },
    { label: 'Charges fixes ÷ Taux de MCV', feedback: 'C’est le seuil de rentabilité lui-même.' },
  ], { difficulty: 1, competency: 'Seuil de rentabilité', explanation: 'La marge de sécurité mesure la baisse de CA que l’entreprise peut supporter avant de subir une perte.' }),
  { chapter: 'cg2', type: 'calc', prompt: 'Avec un CA de 50 000 000 et un seuil de rentabilité de 30 000 000, à quel jour de l’année (année commerciale de 360 jours, activité régulière) le point mort est-il atteint ?', answer: { value: 216, tolerance: 0.5, unit: 'jours' }, difficulty: 2, competency: 'Point mort', explanation: 'Point mort = 30 000 000 ÷ 50 000 000 × 360 = 216 jours, soit vers le 6 août.' },
  { chapter: 'cg1', type: 'truefalse', prompt: 'Dans la méthode des centres d’analyse, les charges indirectes sont réparties entre les centres puis imputées aux coûts au moyen d’unités d’œuvre.', answer: { value: true }, difficulty: 1, competency: 'Coûts complets', diagnostic: true, explanation: 'Répartition primaire, répartition secondaire, puis imputation aux coûts selon les unités d’œuvre consommées.' },
  { chapter: 'cg1', type: 'calc', prompt: 'Après répartition secondaire, le centre « Atelier » totalise 4 800 000 FCFA. L’unité d’œuvre est l’heure-machine ; 3 200 heures ont été travaillées. Quel est le coût de l’unité d’œuvre (en FCFA) ?', answer: { value: 1500, tolerance: 0.5, unit: 'FCFA' }, difficulty: 1, competency: 'Coûts complets', explanation: 'Coût de l’UO = 4 800 000 ÷ 3 200 = 1 500 FCFA par heure-machine.' },
  { chapter: 'cg1', type: 'match', prompt: 'Associez chaque catégorie de charges à son traitement en comptabilité analytique.', answer: { left: ['Charges directes', 'Charges indirectes', 'Charges non incorporables', 'Éléments supplétifs'], right: ['Ajoutés aux coûts (ex. rémunération des capitaux propres)', 'Affectées sans calcul intermédiaire à un coût', 'Exclues des coûts', 'Réparties via les centres d’analyse'], pairs: [[0, 1], [1, 3], [2, 2], [3, 0]] }, difficulty: 2, competency: 'Coûts complets', explanation: 'Charges incorporables = charges de la comptabilité générale − charges non incorporables + éléments supplétifs.' },
  mcq('cg3', 'Prévu pour la production réelle : 1 000 kg de matière à 500 F/kg. Réel : 1 100 kg à 520 F/kg. L’écart sur quantité est de :', [
    { label: '50 000 F défavorable', correct: true },
    { label: '52 000 F défavorable', feedback: 'Vous avez valorisé l’écart au prix réel : l’écart sur quantité se valorise au prix préétabli.' },
    { label: '22 000 F défavorable', feedback: 'C’est l’écart sur prix.' },
    { label: '50 000 F favorable', feedback: 'Une surconsommation de matière est défavorable.' },
  ], { difficulty: 2, competency: 'Analyse des écarts', diagnostic: true, explanation: 'Écart sur quantité = (1 100 − 1 000) × 500 = 50 000, défavorable car la consommation réelle dépasse la prévision.' }),
  { chapter: 'cg3', type: 'calc', prompt: 'Même énoncé (réel : 1 100 kg à 520 F ; préétabli : 500 F/kg). Quel est l’écart sur prix (en FCFA, valeur positive si défavorable) ?', answer: { value: 22000, tolerance: 1, unit: 'FCFA' }, difficulty: 2, competency: 'Analyse des écarts', explanation: 'Écart sur prix = (520 − 500) × 1 100 = 22 000 défavorable.' },
  { chapter: 'cg3', type: 'short', prompt: 'Quel document prévisionnel présente, mois par mois, les encaissements et les décaissements de l’entreprise ?', answer: { accepted: ['Budget de trésorerie', 'le budget de trésorerie', 'plan de trésorerie'] }, difficulty: 1, competency: 'Gestion budgétaire', explanation: 'Le budget de trésorerie synthétise les encaissements et décaissements issus des autres budgets.' },
  { chapter: 'cg2', type: 'truefalse', prompt: 'La méthode du coût variable intègre les charges fixes dans le coût des produits.', answer: { value: false }, difficulty: 1, competency: 'Coûts partiels', explanation: 'Le coût variable n’intègre que les charges variables ; les charges fixes sont couvertes globalement par la marge sur coût variable.' },

  // ---------- Finance d'entreprise ----------
  { chapter: 'fe1', type: 'calc', prompt: 'Ressources stables : 80 000 000 ; emplois stables : 65 000 000. Quel est le fonds de roulement (en FCFA) ?', answer: { value: 15000000, tolerance: 1, unit: 'FCFA' }, difficulty: 1, competency: 'Équilibre financier', diagnostic: true, explanation: 'FR = Ressources stables − Emplois stables = 15 000 000.' },
  { chapter: 'fe1', type: 'calc', prompt: 'Fonds de roulement : 15 000 000 ; BFR : 18 000 000. Quelle est la trésorerie nette (en FCFA, avec son signe) ?', answer: { value: -3000000, tolerance: 1, unit: 'FCFA' }, difficulty: 1, competency: 'Équilibre financier', explanation: 'TN = FR − BFR = 15 000 000 − 18 000 000 = −3 000 000.' },
  mcq('fe1', 'Une trésorerie nette négative signifie que :', [
    { label: 'Le BFR est supérieur au fonds de roulement', correct: true },
    { label: 'L’entreprise est nécessairement en perte', feedback: 'La trésorerie nette ne mesure pas la rentabilité.' },
    { label: 'Le fonds de roulement est négatif', feedback: 'Pas nécessairement : le FR peut être positif mais insuffisant.' },
    { label: 'Les emplois stables sont trop faibles', feedback: 'Des emplois stables faibles augmentent au contraire le FR.' },
  ], { difficulty: 1, competency: 'Équilibre financier', explanation: 'TN = FR − BFR < 0 ⇔ BFR > FR : une partie du cycle d’exploitation est financée par des concours bancaires courants.' }),
  { chapter: 'fe1', type: 'short', prompt: 'Quel indicateur exprime l’excédent des ressources stables sur les emplois stables ?', answer: { accepted: ['Fonds de roulement', 'fonds de roulement net global', 'FRNG', 'FR'] }, difficulty: 1, competency: 'Équilibre financier', explanation: 'Le fonds de roulement (net global) = ressources stables − emplois stables.' },
  { chapter: 'fe2', type: 'calc', prompt: 'Investissement : 10 000 000. Flux nets de trésorerie : 4 200 000 par an pendant 3 ans. Taux d’actualisation : 10 %. Quelle est la VAN (en FCFA, arrondie à l’unité) ?', answer: { value: 444778, tolerance: 500, unit: 'FCFA' }, difficulty: 2, competency: 'Actualisation', diagnostic: true, explanation: 'Facteur d’annuité = [1 − 1,1^−3] ÷ 0,1 = 2,486852. VAN = 4 200 000 × 2,486852 − 10 000 000 ≈ 444 778.' },
  mcq('fe2', 'Le taux de rentabilité interne (TRI) est le taux d’actualisation pour lequel :', [
    { label: 'La VAN est nulle', correct: true },
    { label: 'La VAN est maximale', feedback: 'La VAN diminue quand le taux augmente : elle n’a pas de maximum à ce taux.' },
    { label: 'Le délai de récupération est égal à la durée du projet', feedback: 'Ce n’est pas la définition du TRI.' },
    { label: 'Le résultat comptable est nul', feedback: 'Le TRI repose sur des flux de trésorerie, pas sur le résultat.' },
  ], { difficulty: 1, competency: 'Actualisation', explanation: 'Par définition, le TRI annule la VAN. Un projet est acceptable si TRI > taux exigé.' }),
  { chapter: 'fe2', type: 'truefalse', prompt: 'Un projet indépendant dont la VAN est positive au taux exigé par les investisseurs crée de la valeur.', answer: { value: true }, difficulty: 1, competency: 'Décision d’investissement', explanation: 'VAN > 0 : le projet rapporte plus que la rentabilité exigée.' },
  { chapter: 'fe2', type: 'calc', prompt: 'Un investissement de 9 000 000 génère des flux constants de 2 400 000 par an. Quel est le délai de récupération simple (en années, décimales acceptées) ?', answer: { value: 3.75, relTolerance: 0.01, unit: 'ans' }, difficulty: 1, competency: 'Décision d’investissement', explanation: 'Délai = 9 000 000 ÷ 2 400 000 = 3,75 ans (3 ans et 9 mois).' },
  { chapter: 'fe3', type: 'calc', prompt: 'Capitaux propres : 60 M (coût 12 %) ; dettes : 40 M (coût avant impôt 8 %) ; taux d’impôt sur les sociétés : 30 %. Quel est le CMPC (en %, avec 2 décimales) ?', answer: { value: 9.44, tolerance: 0.02, unit: '%' }, difficulty: 3, competency: 'Coût du capital', diagnostic: true, explanation: 'CMPC = 60 % × 12 % + 40 % × 8 % × (1 − 30 %) = 7,20 % + 2,24 % = 9,44 %.' },
  mcq('fe3', 'L’effet de levier financier est favorable lorsque :', [
    { label: 'La rentabilité économique après impôt est supérieure au coût de la dette après impôt', correct: true },
    { label: 'L’endettement est nul', feedback: 'Sans dette, il n’y a pas d’effet de levier.' },
    { label: 'Le coût de la dette dépasse la rentabilité économique', feedback: 'C’est l’effet de massue : l’endettement réduit la rentabilité financière.' },
    { label: 'Les capitaux propres sont supérieurs aux dettes', feedback: 'La structure seule ne détermine pas le sens de l’effet.' },
  ], { difficulty: 2, competency: 'Coût du capital', explanation: 'Rf = Re + (Re − i) × D/CP : l’effet est positif si Re > i.' }),
];

/* ------------------------------------------------------------------ */
/* Cas pratiques : 2                                                    */
/* ------------------------------------------------------------------ */
export const exercises = [
  {
    chapter: 'cg2',
    kind: 'cas',
    title: 'Kossi Industrie : seuil de rentabilité et décision d’investissement',
    duration_min: 45,
    difficulty: 2,
    statement:
      'La société Kossi Industrie (entreprise fictive) fabrique des emballages. La direction souhaite connaître sa situation au regard du risque d’exploitation et mesurer l’impact d’un investissement de modernisation. L’activité est supposée régulière sur l’année (12 mois, du 1er janvier au 31 décembre).',
    annexes: [
      {
        title: 'Annexe 1 — Compte de résultat différentiel de l’exercice N (en FCFA)',
        table: {
          head: ['Élément', 'Montant'],
          rows: [
            ['Chiffre d’affaires', '120 000 000'],
            ['Charges variables', '72 000 000'],
            ['Charges fixes', '30 000 000'],
          ],
        },
      },
      { title: 'Annexe 2 — Projet de modernisation', body: 'L’investissement envisagé augmenterait les charges fixes annuelles de 6 000 000 FCFA, sans modifier le taux de marge sur coût variable.' },
    ],
    items: [
      { prompt: 'Calculez la marge sur coût variable et le taux de marge sur coût variable.', hints: ['MCV = CA − charges variables.', 'Taux = MCV ÷ CA.'], solution: 'MCV = 120 000 000 − 72 000 000 = 48 000 000.\nTaux de MCV = 48 000 000 ÷ 120 000 000 = 40 %.', points: 3, criteria: ['MCV exacte (1,5 pt)', 'Taux exact (1,5 pt)'] },
      { prompt: 'Déterminez le seuil de rentabilité et le résultat de l’exercice.', hints: ['SR = CF ÷ taux de MCV.', 'Résultat = MCV − CF.'], solution: 'SR = 30 000 000 ÷ 0,40 = 75 000 000.\nRésultat = 48 000 000 − 30 000 000 = 18 000 000.', points: 4, criteria: ['Formule du SR (1 pt)', 'SR exact (2 pts)', 'Résultat exact (1 pt)'] },
      { prompt: 'Calculez la marge de sécurité, l’indice de sécurité et la date du point mort.', hints: ['Marge de sécurité = CA − SR.', 'Point mort en mois = SR ÷ CA × 12.'], solution: 'Marge de sécurité = 120 000 000 − 75 000 000 = 45 000 000.\nIndice de sécurité = 45 000 000 ÷ 120 000 000 = 37,5 %.\nPoint mort = 75/120 × 12 = 7,5 mois, soit le 15 août N.', points: 5, criteria: ['Marge de sécurité (1,5 pt)', 'Indice (1,5 pt)', 'Date du point mort (2 pts)'] },
      { prompt: 'Quel chiffre d’affaires faudrait-il réaliser après l’investissement pour conserver le même résultat ? Commentez.', hints: ['Les charges fixes deviennent 36 000 000.', 'CA requis = (CF + résultat visé) ÷ taux de MCV.'], solution: 'CA requis = (36 000 000 + 18 000 000) ÷ 0,40 = 135 000 000, soit +12,5 %.\nCommentaire : l’investissement accroît le levier opérationnel et le risque d’exploitation ; il ne se justifie que si une hausse durable des ventes est attendue.', points: 8, criteria: ['Nouvelles charges fixes (1 pt)', 'CA requis exact (4 pts)', 'Commentaire argumenté sur le risque (3 pts)'] },
    ],
  },
  {
    chapter: 'fe1',
    kind: 'cas',
    title: 'Faso Agro : équilibre financier et projet d’extension',
    duration_min: 60,
    difficulty: 3,
    statement:
      'La société Faso Agro (entreprise fictive) transforme des produits agricoles. Son directeur financier vous demande d’analyser l’équilibre financier à partir du bilan fonctionnel condensé, puis d’évaluer un projet d’extension.',
    annexes: [
      {
        title: 'Annexe 1 — Bilan fonctionnel condensé au 31/12/N (en millions FCFA)',
        table: {
          head: ['Emplois', 'Montant', 'Ressources', 'Montant'],
          rows: [
            ['Emplois stables', '180', 'Ressources stables', '210'],
            ['Actif circulant d’exploitation', '95', 'Passif circulant d’exploitation', '70'],
            ['Actif circulant HAO', '5', 'Passif circulant HAO', '8'],
            ['Trésorerie actif', '12', 'Trésorerie passif', '4'],
            ['Total', '292', 'Total', '292'],
          ],
        },
      },
      { title: 'Annexe 2 — Projet d’extension', body: 'Investissement : 50 000 000 FCFA. Flux nets de trésorerie attendus : 15 000 000 FCFA par an pendant 5 ans. Valeur résiduelle nulle. Taux d’actualisation retenu : 12 %.' },
    ],
    items: [
      { prompt: 'Calculez le fonds de roulement, le BFR (exploitation et HAO) et la trésorerie nette. Vérifiez la relation fondamentale.', hints: ['FR = ressources stables − emplois stables.', 'BFE = ACE − PCE ; BFHAO = ACHAO − PCHAO.', 'TN = trésorerie actif − trésorerie passif.'], solution: 'FR = 210 − 180 = 30 M.\nBFE = 95 − 70 = 25 M ; BFHAO = 5 − 8 = −3 M ; BFR = 22 M.\nTN = 30 − 22 = 8 M = 12 − 4 : la relation est vérifiée.', points: 6, criteria: ['FR (1,5 pt)', 'BFE et BFHAO (2 pts)', 'TN et vérification (2,5 pts)'] },
      { prompt: 'Commentez l’équilibre financier de Faso Agro.', hints: ['Comparez FR et BFR.', 'Que représente le BFR en proportion du FR ?'], solution: 'Le FR (30 M) couvre intégralement le BFR (22 M) : la trésorerie nette est positive (8 M). L’équilibre est satisfaisant ; le BFR d’exploitation, élevé, doit toutefois être surveillé (stocks saisonniers de produits agricoles, délais clients).', points: 4, criteria: ['Constat FR > BFR (2 pts)', 'Analyse du BFR et du secteur (2 pts)'] },
      { prompt: 'Calculez la VAN du projet d’extension.', hints: ['Facteur d’annuité à 12 % sur 5 ans = [1 − 1,12^−5] ÷ 0,12.', 'Ce facteur vaut environ 3,6048.'], solution: 'Facteur = 3,604776.\nVAN = 15 000 000 × 3,604776 − 50 000 000 ≈ 4 071 643 FCFA.', points: 6, criteria: ['Facteur d’actualisation (2 pts)', 'VAN exacte à ±1 000 près (4 pts)'] },
      { prompt: 'Le projet doit-il être retenu ? Quelles réserves formulez-vous ?', hints: ['Signe de la VAN.', 'Le TRI est d’environ 15,2 %.'], solution: 'VAN > 0 (TRI ≈ 15,2 % > 12 %) : le projet crée de la valeur et peut être retenu.\nRéserves : sensibilité des flux aux prix agricoles, financement du BFR supplémentaire généré par l’extension, impact sur la trésorerie (8 M) si le projet est autofinancé.', points: 4, criteria: ['Décision justifiée (2 pts)', 'Au moins deux réserves pertinentes (2 pts)'] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Flashcards : 20                                                      */
/* ------------------------------------------------------------------ */
export const flashcards = [
  { chapter: 'cf1', front: 'Que regroupe la classe 8 du SYSCOHADA révisé ?', back: 'Les comptes des autres charges et des autres produits, notamment les opérations hors activités ordinaires (HAO).' },
  { chapter: 'cf1', front: 'Quelle classe correspond aux comptes de tiers ?', back: 'La classe 4 (fournisseurs, clients, personnel, État…).' },
  { chapter: 'cf1', front: 'À quoi sert la classe 9 ?', back: 'À la comptabilité analytique de gestion (et aux engagements hors bilan).' },
  { chapter: 'cf2', front: 'Formule de la dotation linéaire la première année', back: '(Base amortissable ÷ durée d’utilité) × (mois d’utilisation ÷ 12)' },
  { chapter: 'cf2', front: 'Comment calculer la VCN d’un bien cédé ?', back: 'Coût d’entrée − amortissements cumulés, dotation complémentaire de l’année de cession comprise.' },
  { chapter: 'cf2', front: 'Où enregistrer le prix de cession d’une immobilisation ?', back: 'En produit HAO, compte 82 (produits des cessions d’immobilisations).' },
  { chapter: 'cf3', front: 'Différence entre dépréciation et provision ?', back: 'Dépréciation : perte de valeur d’un actif. Provision : passif à échéance ou montant incertain.' },
  { chapter: 'cf3', front: 'Sur quelle base calcule-t-on la dépréciation d’une créance ?', back: 'Sur le montant hors taxes de la créance.' },
  { chapter: 'cg1', front: 'Qu’est-ce qu’une unité d’œuvre ?', back: 'L’unité de mesure de l’activité d’un centre d’analyse, utilisée pour imputer ses charges aux coûts.' },
  { chapter: 'cg1', front: 'Charges incorporables = ?', back: 'Charges de la comptabilité générale − charges non incorporables + éléments supplétifs.' },
  { chapter: 'cg2', front: 'Formule du seuil de rentabilité', back: 'SR = Charges fixes ÷ Taux de marge sur coût variable' },
  { chapter: 'cg2', front: 'Indice de sécurité', back: '(CA − SR) ÷ CA' },
  { chapter: 'cg2', front: 'Point mort en jours (année de 360 jours)', back: 'SR ÷ CA × 360' },
  { chapter: 'cg3', front: 'Écart sur prix (matières)', back: '(Prix réel − Prix préétabli) × Quantité réelle' },
  { chapter: 'cg3', front: 'Écart sur quantité (matières)', back: '(Quantité réelle − Quantité préétablie) × Prix préétabli' },
  { chapter: 'fe1', front: 'Relation fondamentale du bilan fonctionnel', back: 'Trésorerie nette = Fonds de roulement − BFR' },
  { chapter: 'fe1', front: 'BFR d’exploitation', back: 'Actif circulant d’exploitation − Passif circulant d’exploitation' },
  { chapter: 'fe2', front: 'Formule de la VAN avec annuités constantes', back: 'VAN = a × [1 − (1 + t)^−n] ÷ t − I₀' },
  { chapter: 'fe2', front: 'Critère de décision avec le TRI', back: 'Accepter le projet si TRI > taux de rentabilité exigé.' },
  { chapter: 'fe3', front: 'Formule du CMPC', back: 'CMPC = Kcp × CP/(CP + D) + Kd × (1 − IS) × D/(CP + D)' },
];

/* ------------------------------------------------------------------ */
/* Examen blanc : 1 modèle (le sujet est tiré à chaque tentative)       */
/* ------------------------------------------------------------------ */
export const exams = [
  {
    title: 'Examen blanc n°1 — démonstration',
    description: 'Sujet équilibré : 4 questions par matière, mélange de difficultés. Durée : 30 minutes.',
    duration_min: 30,
    config: { perSubject: 4, difficultyMix: { 1: 2, 2: 1, 3: 1 } },
  },
];
