import { Router } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadLimiter } from '../middleware/rateLimiter';
import {
  UpdateDocumentSchema,
  ApplicationIdParamSchema,
  UuidParamSchema,
} from '../middleware/validate';
import { s3Client, S3_BUCKET } from '../services/documents';
import * as ctrl from '../controllers/documents';

const router = Router();

router.use(requireAuth);

// ─── S3 upload middleware ─────────────────────────────────────────────────────

const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop() ?? 'bin';
      cb(null, `documents/${uuidv4()}.${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /documents/:applicationId
router.get(
  '/:applicationId',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.list
);

// POST /documents/:applicationId/upload
router.post(
  '/:applicationId/upload',
  uploadLimiter,
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(ApplicationIdParamSchema, 'params'),
  upload.single('file'),
  ctrl.upload
);

// GET /documents/:applicationId/:id/download-url
router.get(
  '/:applicationId/:id/download-url',
  validate(ApplicationIdParamSchema, 'params'),
  ctrl.downloadUrl
);

// PATCH /documents/:applicationId/:id/status
router.patch(
  '/:applicationId/:id/status',
  requireRole(['ADMIN', 'UNDERWRITER']),
  validate(UpdateDocumentSchema),
  ctrl.updateStatus
);

// DELETE /documents/:applicationId/:id
router.delete(
  '/:applicationId/:id',
  requireRole(['ADMIN', 'UNDERWRITER']),
  ctrl.remove
);

export default router;
