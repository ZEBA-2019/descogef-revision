import crypto from 'node:crypto';
import { one, run } from './db.js';
import { config } from './config.js';
import { HttpError } from './http.js';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
export const COOKIE_NAME = 'dsg_session';

/** Hache un mot de passe avec scrypt et un sel aléatoire. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [algo, saltB64, hashB64] = String(stored).split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Crée une session ; seul le hachage du jeton est stocké en base. */
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
  await run('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, expires.toISOString());
  return { token, expires };
}

export async function destroySession(token) {
  if (token) await run('DELETE FROM auth_sessions WHERE token_hash = ?', sha256(token));
}

export function setSessionCookie(res, token, expires) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    expires,
    path: '/',
  });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export const publicUser = (u) =>
  u && {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    examDate: u.exam_date,
    diagnosticDone: Boolean(u.diagnostic_done),
    levels: JSON.parse(u.levels || '{}'),
    settings: JSON.parse(u.settings || '{}'),
    createdAt: u.created_at,
  };

/** Middleware : charge l'utilisateur à partir du cookie de session. */
export async function loadUser(req, _res, next) {
  const token = readCookie(req, COOKIE_NAME);
  req.sessionToken = token;
  if (token) {
    let row;
    try {
      row = await one(
      `SELECT u.* FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
        sha256(token),
        new Date().toISOString()
      );
    } catch (e) {
      return next(e);
    }
    if (row) req.user = row;
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Veuillez vous connecter.'));
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Veuillez vous connecter.'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Accès réservé aux administrateurs.'));
  next();
}

/** Limiteur simple en mémoire (par IP + clé) pour les routes sensibles. */
export function rateLimit({ windowMs, max, key = 'default' }) {
  const hits = new Map();
  return (req, _res, next) => {
    const id = `${key}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(id) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) {
      entry.count = 0;
      entry.reset = now + windowMs;
    }
    entry.count += 1;
    hits.set(id, entry);
    if (entry.count > max) return next(new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.'));
    next();
  };
}
