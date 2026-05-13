import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // ── Zod validation errors ──────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const response: ApiError = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    };
    res.status(400).json(response);
    return;
  }

  // ── Prisma known errors ────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation
        const fields = (err.meta?.target as string[]) ?? [];
        res.status(409).json({
          error: `Duplicate value for: ${fields.join(', ')}`,
          code: 'CONFLICT',
          details: { fields },
        });
        return;
      }
      case 'P2025': {
        // Record not found
        res.status(404).json({
          error: 'Record not found',
          code: 'NOT_FOUND',
        });
        return;
      }
      case 'P2003': {
        // Foreign key constraint
        res.status(400).json({
          error: 'Referenced record does not exist',
          code: 'INVALID_REFERENCE',
        });
        return;
      }
      default: {
        logger.error('Prisma known error', { code: err.code, message: err.message });
        res.status(500).json({ error: 'Database error', code: 'DB_ERROR' });
        return;
      }
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'Invalid database query',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // ── Generic errors ─────────────────────────────────────────────────────────
  if (err instanceof Error) {
    // Operational errors with a status attached
    const withStatus = err as Error & { statusCode?: number; code?: string };
    const status = withStatus.statusCode ?? 500;
    const code = withStatus.code ?? 'INTERNAL_ERROR';

    if (status < 500) {
      res.status(status).json({ error: err.message, code });
      return;
    }

    logger.error('Unhandled error', { message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    return;
  }

  logger.error('Unknown error type thrown', { err });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
