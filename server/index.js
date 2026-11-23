import { createApp } from './app.js';
import { getDb } from './db.js';
import { seedContent, ensureAdmin } from './seed.js';
import { config } from './config.js';

getDb();
// Au premier lancement, la base est initialisée avec le contenu de démonstration
const { seeded } = seedContent();
const { created } = ensureAdmin();
if (seeded) console.log('✔ Contenu de démonstration chargé.');
if (created) console.log(`✔ Compte administrateur créé : ${config.adminEmail} (changez le mot de passe !)`);

createApp().listen(config.port, () => {
  console.log(`DESCOGEF Révision — API sur http://localhost:${config.port}`);
});
