import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import logger from './utils/logger';
import { errorHandler } from './middleware/error';
import apiRouter from './routes/index';

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────

app.use(helmet());
const _corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server (no origin) and localhost in dev
      if (!origin) return cb(null, true);
      // Allow any Vercel preview/prod deployment plus explicitly configured origins
      if (
        _corsOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost')
      ) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
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
});

export default app;
