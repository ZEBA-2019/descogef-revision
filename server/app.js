import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { loadUser } from './auth.js';
import { errorHandler, HttpError } from './http.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import contentRoutes from './routes/content.js';
import planningRoutes from './routes/planning.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // En-têtes de sécurité
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.isProd) {
      res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'");
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Protection CSRF : les requêtes modifiantes doivent provenir de la même origine
  app.use('/api', (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const allowed = config.allowedOrigin ? [config.allowedOrigin] : [];
      if (new URL(origin).host !== host && !allowed.includes(origin)) return next(new HttpError(403, 'Origine de la requête non autorisée.'));
    }
    next();
  });

  app.use('/api', loadUser);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', quizRoutes);
  app.use('/api', contentRoutes);
  app.use('/api', planningRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Ressource introuvable.')));

  // Interface compilée (production)
  const dist = path.join(config.root, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
