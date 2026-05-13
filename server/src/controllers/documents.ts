import { Request, Response, NextFunction } from 'express';
import {
  createDocumentRecord,
  listDocuments,
  updateDocumentStatus,
  deleteDocument,
  getPresignedDownloadUrl,
} from '../services/documents';
import type { DocumentType, DocumentStatus } from '@prisma/client';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const docs = await listDocuments(req.params.applicationId, req.user.tenantId);
    if (docs === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(docs);
  } catch (err) {
    next(err);
  }
}

export async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // multer-s3 attaches file info to req.file
    const file = req.file as Express.MulterS3.File | undefined;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded', code: 'VALIDATION_ERROR' });
      return;
    }

    const { type } = req.body as { type?: DocumentType };
    if (!type) {
      res.status(400).json({ error: 'Document type is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const doc = await createDocumentRecord(
      req.params.applicationId,
      req.user.id,
      req.user.tenantId,
      file.originalname,
      type,
      file.key,
      file.location
    );

    if (!doc) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = req.body as { status: DocumentStatus };
    const result = await updateDocumentStatus(
      req.params.id,
      req.params.applicationId,
      req.user.tenantId,
      req.user.id,
      status
    );
    if (!result) {
      res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteDocument(
      req.params.id,
      req.params.applicationId,
      req.user.tenantId,
      req.user.id
    );
    if (!result) {
      res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function downloadUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const url = await getPresignedDownloadUrl(
      req.params.id,
      req.params.applicationId,
      req.user.tenantId
    );
    if (!url) {
      res.status(404).json({ error: 'Document not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ url });
  } catch (err) {
    next(err);
  }
}
