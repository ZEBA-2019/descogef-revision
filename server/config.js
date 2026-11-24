import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  root,
  port: Number(process.env.PORT || 3001),
  isProd: process.env.NODE_ENV === 'production' || process.argv.includes('--production'),
  // Postgres hébergé (Neon via Vercel) ; sinon PGlite local
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL || null,
  // Adresse de secours (ex. autre hôte de pooler) essayée si la première est injoignable
  databaseUrlFallback: process.env.DATABASE_URL_FALLBACK || null,
  // Schéma Postgres dédié (ex. « descogef » sur Supabase) ; sinon le schéma par défaut
  databaseSchema: process.env.DATABASE_SCHEMA || null,
  dbPath: process.env.DATABASE_PATH || path.join(root, 'data', 'pglite'),
  sessionDays: Number(process.env.SESSION_DAYS || 30),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@descogef.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangezMoi-2026!',
  allowedOrigin: process.env.APP_ORIGIN || null,
};
