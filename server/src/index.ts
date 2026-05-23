import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import logger from './utils/logger';
import { errorHandler } from './middleware/error';
import apiRouter from './routes/index';
import { autoSeedIfEmpty } from './utils/autoSeed';

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────

app.use(helmet());

// Origins that are always allowed regardless of CORS_ORIGIN env var
const _hardcodedOrigins = [
  'https://jmur.vercel.app',
  'https://web-production-52930a.up.railway.app',
];
const _envOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const _allowedOrigins = new Set([..._hardcodedOrigins, ..._envOrigins]);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server (no origin header), e.g. curl or internal calls
      if (!origin) return cb(null, true);
      // Allow localhost in development
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return cb(null, true);
      }
      // Allow any Vercel preview/production deployment (*.vercel.app)
      if (origin.endsWith('.vercel.app')) return cb(null, true);
      // Allow explicitly configured origins
      if (_allowedOrigins.has(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-test-user-id'],
  })
);

// Raw body needed for Clerk webhook signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── Global error handler ────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.listen(PORT, () => {
  logger.info(`ClearPath UW API listening on port ${PORT}`, {
    env: process.env.NODE_ENV ?? 'development',
  });
  autoSeedIfEmpty().catch((err) => logger.error('Auto-seed failed', { err }));
});

export default app;
