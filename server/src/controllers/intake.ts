import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { processZipUpload, processFinmoPdf, processSubmissionNotes } from '../services/intake';
import { createApplication } from '../services/applications';
import logger from '../utils/logger';

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

// Bundle multiple files into a single zip buffer
function bundleFiles(files: Express.Multer.File[]): { buffer: Buffer; originalname: string } {
  if (files.length === 1) {
    return { buffer: files[0].buffer, originalname: files[0].originalname };
  }
  const zip = new AdmZip();
  for (const f of files) {
    zip.addFile(f.originalname, f.buffer);
  }
  return { buffer: zip.toBuffer(), originalname: 'bundle.zip' };
}

export async function handleZipUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const singleFile = req.file;
    const allFiles = files?.length ? files : singleFile ? [singleFile] : [];

    if (!allFiles.length) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const app = await createApplication(req.user.tenantId, req.user.id);
    const { buffer, originalname } = bundleFiles(allFiles);

    // Start processing async — return immediately with applicationId
    processZipUpload(app.id, buffer, req.user.tenantId, originalname).catch((err: unknown) => logger.error('async intake processing failed', { error: err instanceof Error ? err.message : String(err) }));

    res.json({ applicationId: app.id, documentCount: allFiles.length, status: 'PROCESSING' });
  } catch (err) { next(err); }
}

export async function handleFinmoImport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const app = await createApplication(req.user.tenantId, req.user.id);
    processFinmoPdf(app.id, file.buffer, req.user.tenantId).catch((err: unknown) => logger.error('async intake processing failed', { error: err instanceof Error ? err.message : String(err) }));

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
    processSubmissionNotes(app.id, text.trim(), req.user.tenantId).catch((err: unknown) => logger.error('async intake processing failed', { error: err instanceof Error ? err.message : String(err) }));

    res.json({ applicationId: app.id });
  } catch (err) { next(err); }
}
