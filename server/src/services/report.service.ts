/**
 * Module purpose: Builds permission-scoped compliance reports and transforms the results to CSV or PDF.
 */
import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import { businessRepository, filingRepository, taskRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { formatDate } from '../utils/dates';
import { complianceRate } from './business.service';

export interface ReportParams {
  businessId: string;
  from: Date;
  to: Date;
}

/**
 * Loads tasks and filings for the requested business/date range, then calculates compliance totals and agency summaries.
 */
async function buildComplianceReport({ businessId, from, to }: ReportParams) {
  const business = await businessRepository.findById(businessId);
  if (!business) throw ApiError.notFound('Business not found');
  const bId = new Types.ObjectId(businessId);
  // Report counts come only from tasks inside the selected date interval and exclude not-applicable tasks.
  const tasks = await taskRepository.find(
    { businessId: bId, dueDate: { $gte: from, $lte: to }, status: { $ne: 'NOT_APPLICABLE' } },
    { sort: { dueDate: 1 }, populate: { path: 'agencyId', select: 'acronym name' } },
  );
  const filings = await filingRepository.find(
    { businessId: bId, filingDate: { $gte: from, $lte: to } },
    { sort: { filingDate: -1 }, populate: [{ path: 'taskId', select: 'title periodLabel' }, { path: 'filedBy', select: 'firstName lastName' }] },
  );
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const overdue = tasks.filter((t) => t.status === 'OVERDUE').length;
  const pending = tasks.length - completed - overdue;
  const onTime = tasks.filter((t) => t.status === 'COMPLETED' && t.completedAt && t.completedAt <= new Date(t.dueDate.getTime() + 86_399_999)).length;

  const byAgency = new Map<string, { agency: string; total: number; completed: number; overdue: number }>();
  for (const t of tasks) {
    const key = (t.agencyId as any)?.acronym ?? 'Other';
    const e = byAgency.get(key) ?? { agency: key, total: 0, completed: 0, overdue: 0 };
    e.total++;
    if (t.status === 'COMPLETED') e.completed++;
    if (t.status === 'OVERDUE') e.overdue++;
    byAgency.set(key, e);
  }

  return {
    generatedAt: new Date(),
    business: {
      _id: business._id,
      businessName: business.businessName,
      legalName: business.legalName,
      registrationNumber: business.registrationNumber,
      taxIdentificationNumber: business.taxIdentificationNumber,
      state: business.state,
      businessType: business.businessType,
    },
    period: { from, to },
    summary: {
      total: tasks.length,
      completed,
      pending,
      overdue,
      completedOnTime: onTime,
      compliancePercentage: complianceRate(completed, overdue),
    },
    byAgency: [...byAgency.values()],
    tasks: tasks.map((t) => ({
      _id: t._id,
      title: t.title,
      agency: (t.agencyId as any)?.acronym ?? '',
      category: t.category,
      period: t.periodLabel ?? t.period,
      dueDate: t.dueDate,
      status: t.status,
      completedAt: t.completedAt,
    })),
    filings: filings.map((f) => ({
      _id: f._id,
      task: (f.taskId as any)?.title ?? '',
      period: (f.taskId as any)?.periodLabel ?? '',
      // NOTE: `FilingRecord.filingDate` is typed loosely in the schema (Date-like | null | undefined)
      // rather than as `Date`. The query above filters by `filingDate: { $gte: from, $lte: to }`,
      // so any returned record has a valid Date here. Assert to `Date` so downstream consumers
      // (formatDate in toPdf) see the correct type.
      filingDate: f.filingDate as unknown as Date,
      referenceNumber: f.referenceNumber,
      status: f.status,
      submittedTo: f.submittedTo,
      filedBy: f.filedBy ? `${(f.filedBy as any).firstName} ${(f.filedBy as any).lastName}` : '',
    })),
  };
}

export type ComplianceReport = Awaited<ReturnType<typeof buildComplianceReport>>;

/**
 * Service methods coordinate domain rules, persistence, messaging, or audit records. Callers should use this layer instead of duplicating database logic.
 */
export const reportService = {
  compliance: buildComplianceReport,

  toCsv(report: ComplianceReport): string {
    const esc = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '');
      // Neutralise spreadsheet formula injection.
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [
      ['Business', report.business.businessName].map(esc).join(','),
      ['Period', `${formatDate(report.period.from)} to ${formatDate(report.period.to)}`].map(esc).join(','),
      ['Compliance %', report.summary.compliancePercentage].map(esc).join(','),
      '',
      ['Obligation', 'Agency', 'Category', 'Period', 'Due date', 'Status', 'Completed on'].map(esc).join(','),
      ...report.tasks.map((t) => [t.title, t.agency, t.category, t.period, t.dueDate, t.status, t.completedAt ?? ''].map(esc).join(',')),
      '',
      ['Filing', 'Period', 'Filed on', 'Reference', 'Status', 'Submitted to', 'Recorded by'].map(esc).join(','),
      ...report.filings.map((f) => [f.task, f.period, f.filingDate, f.referenceNumber, f.status, f.submittedTo, f.filedBy].map(esc).join(',')),
    ];
    return lines.join('\n');
  },

  toPdf(report: ComplianceReport): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Compliance report — ${report.business.businessName}` } });
    const ink = '#14233B';
    const green = '#1E6B4A';
    const muted = '#5B6676';

    doc.fillColor(green).fontSize(10).text('SME Comply', { continued: false });
    doc.moveDown(0.3).fillColor(ink).fontSize(20).text('Compliance report');
    doc.fontSize(12).fillColor(ink).text(report.business.businessName);
    doc.fontSize(9).fillColor(muted).text(
      `${formatDate(report.period.from)} to ${formatDate(report.period.to)}  |  Generated ${formatDate(report.generatedAt)}`,
    );
    if (report.business.registrationNumber) doc.text(`RC/BN: ${report.business.registrationNumber}   TIN: ${report.business.taxIdentificationNumber ?? '—'}`);
    doc.moveDown();

    const s = report.summary;
    const boxY = doc.y;
    const cells: Array<[string, string]> = [
      ['Compliance', `${s.compliancePercentage}%`],
      ['Obligations', String(s.total)],
      ['Completed', String(s.completed)],
      ['Open', String(s.pending)],
      ['Overdue', String(s.overdue)],
    ];
    const w = (doc.page.width - 96) / cells.length;
    cells.forEach(([label, value], i) => {
      const x = 48 + i * w;
      doc.rect(x, boxY, w - 6, 48).strokeColor('#DDE2DC').stroke();
      doc.fillColor(label === 'Overdue' && s.overdue > 0 ? '#B42318' : ink).fontSize(16).text(value, x + 8, boxY + 8, { width: w - 22 });
      doc.fillColor(muted).fontSize(8).text(label, x + 8, boxY + 30, { width: w - 22 });
    });
    doc.y = boxY + 64;
    doc.x = 48;

    const table = (title: string, headers: string[], widths: number[], rows: string[][]) => {
      doc.fillColor(ink).fontSize(12).text(title, 48, doc.y);
      doc.moveDown(0.4);
      const drawRow = (cols: string[], bold = false) => {
        if (doc.y > doc.page.height - 80) doc.addPage();
        const y = doc.y;
        let x = 48;
        let maxH = 0;
        cols.forEach((c, i) => {
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(bold ? muted : ink);
          const h = doc.heightOfString(c, { width: widths[i] - 6 });
          doc.text(c, x, y, { width: widths[i] - 6 });
          maxH = Math.max(maxH, h);
          x += widths[i];
        });
        doc.y = y + maxH + 5;
        doc.moveTo(48, doc.y - 2).lineTo(doc.page.width - 48, doc.y - 2).strokeColor('#EEF0EC').stroke();
      };
      drawRow(headers, true);
      if (rows.length === 0) drawRow(['None in this period']);
      rows.forEach((r) => drawRow(r));
      doc.font('Helvetica').moveDown();
    };

    table(
      'Obligations',
      ['Obligation', 'Agency', 'Period', 'Due', 'Status'],
      [190, 60, 90, 80, 79],
      report.tasks.map((t) => [t.title, t.agency, t.period, formatDate(t.dueDate), t.status.replace('_', ' ')]),
    );
    table(
      'Filing history',
      ['Obligation', 'Filed on', 'Reference', 'Status', 'Recorded by'],
      [170, 80, 100, 70, 79],
      report.filings.map((f) => [f.task, formatDate(f.filingDate), f.referenceNumber ?? '—', f.status, f.filedBy]),
    );

    doc.fontSize(7).fillColor(muted).text(
      'SME Comply records filings entered by users; it does not submit filings to government agencies. Regulatory data may include sample entries and should be verified with the relevant authority. This report is not legal or tax advice.',
      48,
      doc.y,
      { width: doc.page.width - 96 },
    );
    doc.end();
    return doc;
  },
};