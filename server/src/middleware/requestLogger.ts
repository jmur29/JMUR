import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * Attaches a unique x-request-id to every request/response.
 * Honours an existing x-request-id header if the upstream proxy already set one.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) ?? uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  next();
}

/**
 * Logs method, path, status code, duration, and requestId on every response finish.
 * Uses 'error' level for 5xx, 'warn' for 4xx, 'info' otherwise.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[level](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      requestId: req.headers['x-request-id'],
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
}
