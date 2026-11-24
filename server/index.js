import { createApp } from './app.js';
import { initDatabase } from './seed.js';
import { config } from './config.js';

// Au premier lancement, la base est initialisée avec le contenu de démonstration
const { seeded, created } = await initDatabase();
if (seeded) console.log('✔ Contenu de démonstration chargé.');
if (created) console.log(`✔ Compte administrateur créé : ${config.adminEmail} (changez le mot de passe !)`);
console.log(config.databaseUrl ? '• Base : PostgreSQL (DATABASE_URL)' : `• Base : PGlite locale (${config.dbPath})`);

createApp().listen(config.port, () => {
  console.log(`DESCOGEF Révision — API sur http://localhost:${config.port}`);
});
