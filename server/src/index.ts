import 'dotenv/config';
import { validateEnv } from './utils/validateEnv';
if (process.env.NODE_ENV !== 'test') validateEnv();
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import logger from './utils/logger';
import { errorHandler } from './middleware/error';
import { apiLimiter } from './middleware/rateLimiter';
import apiRouter from './routes/index';

const app = express();

// ─── Security & parsing ───────────────────────────────────────────────────────

app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for PDF preview iframe
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Clerk requires this
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.clerk.com", "https://*.clerk.accounts.dev"],
      frameSrc: ["'self'", "https:"],
    },
  },
}));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })
);

// Raw body needed for Clerk webhook signature verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// ─── Routes ──────────────────────────────────────────────────────────────────

// General rate limit applied to all API routes
app.use('/api', apiLimiter, apiRouter);

// Health check (outside rate limit)
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
