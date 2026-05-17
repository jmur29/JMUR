import { Request, Response, NextFunction } from 'express';
import { processApplication, pipelineStatus } from '../services/pipeline';
import logger from '../utils/logger';

/**
 * POST /api/applications/:id/process
 * Triggers the AI pipeline for the given application. Runs asynchronously.
 */
export async function startProcessing(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { tenantId, id: userId } = req.user;

    const existing = pipelineStatus.get(id);
    if (existing && existing.stage !== 'COMPLETE' && existing.stage !== 'ERROR') {
      res.status(409).json({
        success: false,
        error: `Pipeline is already running for this application (stage: ${existing.stage})`,
      });
      return;
    }

    // Start processing asynchronously
    processApplication(id, tenantId, userId).catch((err: unknown) => {
      logger.error('Pipeline processing error', {
        applicationId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      pipelineStatus.set(id, {
        applicationId: id,
        stage: 'ERROR',
        progress: 0,
        startedAt: pipelineStatus.get(id)?.startedAt ?? new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    });

    res.status(202).json({
      success: true,
      data: { applicationId: id, message: 'Pipeline started' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/applications/:id/process/status
 * Returns the current pipeline status for the given application.
 */
export async function getProcessingStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const status = pipelineStatus.get(id);
    if (!status) {
      res.json({
        success: true,
        data: {
          applicationId: id,
          stage: 'PENDING',
          progress: 0,
          startedAt: null,
        },
      });
      return;
    }

    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}
