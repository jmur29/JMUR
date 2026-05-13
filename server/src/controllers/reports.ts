import { Request, Response, NextFunction } from 'express';
import { generateHtmlReport, generatePdfReport } from '../services/reports';

export async function htmlReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const html = await generateHtmlReport(req.params.applicationId, req.user.tenantId);
    if (!html) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    next(err);
  }
}

export async function pdfReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const pdf = await generatePdfReport(req.params.applicationId, req.user.tenantId);
    if (!pdf) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="uw-report-${req.params.applicationId}.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    next(err);
  }
}
