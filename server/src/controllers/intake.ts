import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { processZipUpload, processFinmoPdf, processSubmissionNotes } from '../services/intake';
import { createApplication } from '../services/applications';

// Memory storage for processing (don't go to S3, process in memory)
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

export async function handleZipUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const app = await createApplication(req.user.tenantId, req.user.id);
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    // Start processing async (return immediately with applicationId)
    processZipUpload(app.id, file.buffer, req.user.tenantId, file.originalname).catch(console.error);

    res.json({ applicationId: app.id, documentCount: 0, status: 'PROCESSING' });
  } catch (err) { next(err); }
}

export async function handleFinmoImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const app = await createApplication(req.user.tenantId, req.user.id);
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    processFinmoPdf(app.id, file.buffer).catch(console.error);

    res.json({ applicationId: app.id });
  } catch (err) { next(err); }
}

export async function handleSubmissionNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { text } = req.body as { text: string };
    if (!text || text.trim().length < 10) {
      res.status(400).json({ error: 'text is required' });
      return;
    }
    const app = await createApplication(req.user.tenantId, req.user.id);
    processSubmissionNotes(app.id, text.trim()).catch(console.error);

    res.json({ applicationId: app.id });
  } catch (err) { next(err); }
}
