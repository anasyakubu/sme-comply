/**
 * Module purpose: Builds compliance reports in JSON, CSV, or PDF form and sets the correct download response headers.
 */
import { Request, Response } from 'express';
import { reportService } from '../services/report.service';
import { auditContext, auditService } from '../services/audit.service';
import { sendSuccess } from '../utils/response';

/**
 * Converts the already validated reporting query into a business ID and date range for the reporting service.
 */
function params(req: Request) {
  const q = req.query as unknown as { businessId: string; from: Date; to: Date };
  return { businessId: q.businessId, from: new Date(q.from), to: new Date(q.to) };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const reportController = {
  /**
   * Returns compliance report data for an authorized business.
   */
  async compliance(req: Request, res: Response) {
    return sendSuccess(res, 'Report generated', await reportService.compliance(params(req)));
  },
  /**
   * Sends the requested report as a CSV download.
   */
  async csv(req: Request, res: Response) {
    const report = await reportService.compliance(params(req));
    await auditService.log(auditContext(req), 'REPORT_EXPORTED', 'Report', undefined, { businessId: String(report.business._id), metadata: { format: 'csv' } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slug(report.business.businessName)}-compliance.csv"`);
    res.send('\uFEFF' + reportService.toCsv(report));
  },
  /**
   * Sends the requested report as a PDF download.
   */
  async pdf(req: Request, res: Response) {
    const report = await reportService.compliance(params(req));
    await auditService.log(auditContext(req), 'REPORT_EXPORTED', 'Report', undefined, { businessId: String(report.business._id), metadata: { format: 'pdf' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slug(report.business.businessName)}-compliance.pdf"`);
    reportService.toPdf(report).pipe(res);
  },
};
