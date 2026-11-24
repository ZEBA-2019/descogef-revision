/**
 * Accès à la base PostgreSQL.
 *  - Production (Vercel) : Neon / tout Postgres via DATABASE_URL (pilote `pg`).
 *  - Développement et tests : PGlite (Postgres embarqué, aucun serveur à installer),
 *    stocké dans ./data/pglite, ou en mémoire si DATABASE_PATH=":memory:".
 *
 * API : all / one / run (asynchrones), tx(fn) pour les transactions.
 * Les requêtes peuvent utiliser des paramètres `?` (convertis en $1, $2…).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { SCHEMA_SQL } from './schema.js';
import { HttpError } from './http.js';

/** Horodatage ISO 8601 UTC généré côté base (format identique à Date.toISOString()). */
export const NOW = `to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

let driverPromise;
const txStore = new AsyncLocalStorage();

/** Convertit les `?` en `$n` (hors chaînes entre apostrophes). */
export function toPg(sql) {
  let n = 0;
  let out = '';
  let inStr = false;
  for (const ch of sql) {
    if (ch === "'") inStr = !inStr;
    out += ch === '?' && !inStr ? `$${++n}` : ch;
  }
  return out;
}

async function createDriver() {
  if (config.databaseUrl) {
    const pg = (await import('pg')).default;
    pg.types.setTypeParser(20, (v) => Number(v)); // int8 (COUNT, SUM…) -> number
    pg.types.setTypeParser(1700, (v) => Number(v)); // numeric -> number
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
    });
    return {
      query: (sql, params) => pool.query(sql, params),
      async transaction(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const out = await fn({ query: (s, p) => client.query(s, p) });
          await client.query('COMMIT');
          return out;
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
    };
  }

  if (process.env.VERCEL) {
    // Le disque d'une fonction Vercel est éphémère : on refuse plutôt que de perdre des données
    throw new HttpError(503, 'Base de données non configurée : connectez une base Neon au projet Vercel (variable DATABASE_URL).');
  }
  const { PGlite, types } = await import('@electric-sql/pglite');
  const memory = config.dbPath === ':memory:';
  if (!memory) fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  const db = await PGlite.create(memory ? undefined : config.dbPath, {
    parsers: { [types.INT8]: (v) => Number(v), [types.NUMERIC]: (v) => Number(v) },
  });
  // PGlite n'a qu'une connexion : on sérialise les transactions
  let chain = Promise.resolve();
  return {
    query: (sql, params) => db.query(sql, params),
    transaction(fn) {
      const run = chain.then(() => db.transaction((t) => fn({ query: (s, p) => t.query(s, p) })));
      chain = run.catch(() => {});
      return run;
    },
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}

/** Initialise la connexion et le schéma (une seule fois par processus). */
export function getDb() {
  if (!driverPromise) {
    driverPromise = createDriver().then(async (d) => {
      await d.exec(SCHEMA_SQL);
      return d;
    });
    driverPromise.catch(() => (driverPromise = undefined));
  }
  return driverPromise;
}

export async function closeDb() {
  if (!driverPromise) return;
  const d = await driverPromise;
  driverPromise = undefined;
  await d.close();
}

async function query(sql, params) {
  const runner = txStore.getStore() || (await getDb());
  const res = await runner.query(toPg(sql), params);
  return res;
}

/** Exécute fn dans une transaction ; les appels all/one/run à l'intérieur l'utilisent. */
export async function tx(fn) {
  if (txStore.getStore()) return fn();
  const d = await getDb();
  return d.transaction((client) => txStore.run(client, fn));
}

export const all = async (sql, ...params) => (await query(sql, params)).rows;
export const one = async (sql, ...params) => (await query(sql, params)).rows[0];
/** Pour obtenir l'identifiant créé, terminez l'INSERT par « RETURNING id ». */
export const run = async (sql, ...params) => {
  const res = await query(sql, params);
  return { changes: res.rowCount ?? res.affectedRows ?? 0, lastInsertRowid: res.rows?.[0]?.id };
};

export function parseJson(value, fallback) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
