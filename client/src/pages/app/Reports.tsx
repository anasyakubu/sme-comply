/**
 * Module purpose: Fetches business compliance reporting data and supports filtered CSV/PDF exports through the API.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Printer } from 'lucide-react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useBusiness } from '../../context/BusinessContext';
import { useApi } from '../../hooks/useApi';
import { download, errorMessage, get } from '../../lib/api';
import { fmtDate, fmtDue, STATUS_LABEL } from '../../lib/format';
import type { TaskStatus } from '../../types';
import { Button, EmptyState, ErrorState, Input, PageHeader, SkeletonRows, StatusBadge, Table, Td } from '../../components/ui';
import { NoBusiness } from '../../components/business/NoBusiness';

interface Report {
  generatedAt: string;
  business: { businessName: string; registrationNumber?: string; taxIdentificationNumber?: string; state: string; businessType: string };
  period: { from: string; to: string };
  summary: { total: number; completed: number; pending: number; overdue: number; completedOnTime: number; compliancePercentage: number };
  byAgency: Array<{ agency: string; total: number; completed: number; overdue: number }>;
  tasks: Array<{ _id: string; title: string; agency: string; category: string; period: string; dueDate: string; status: TaskStatus; completedAt?: string }>;
  filings: Array<{ _id: string; task: string; period: string; filingDate: string; referenceNumber?: string; status: string; filedBy: string }>;
}

/**
 * Fetches business compliance reporting data and supports filtered CSV/PDF exports through the API.
 */
export default function Reports() {
  const { current, can, loading: loadingBusinesses } = useBusiness();
  const [from, setFrom] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState<string | null>(null);
  const valid = from && to && from <= to;
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const { data, loading, error, reload } = useApi(
    () => get<Report>('/reports/compliance', { businessId: current!._id, from, to }),
    [current?._id, from, to],
    Boolean(current) && Boolean(valid) && can('reports:view'),
  );

  if (!loadingBusinesses && !current) return <NoBusiness />;
  if (current && !can('reports:view')) return <EmptyState title="Reports aren't available to your role" />;

  const exportAs = async (kind: 'csv' | 'pdf') => {
    setExporting(kind);
    try {
      await download(`/reports/compliance.${kind}`, { businessId: current!._id, from, to }, `compliance-report.${kind}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed. Try again.'));
    } finally {
      setExporting(null);
    }
  };

  const s = data?.summary;
  const pie = s
    ? [
        { name: 'Completed', value: s.completed, color: '#1E6B4A' },
        { name: 'Overdue', value: s.overdue, color: '#B42318' },
        { name: 'Open', value: s.pending, color: '#A9B1BC' },
      ].filter((x) => x.value > 0)
    : [];

  return (
    <div>
      <PageHeader
        title="Compliance report"
        description="A summary you can print, or export for your accountant, bank or auditor."
        actions={
          <>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!data}>
              Print
            </Button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting === 'csv'} onClick={() => exportAs('csv')} disabled={!data}>
              Export CSV
            </Button>
            <Button icon={<Download className="h-4 w-4" />} loading={exporting === 'pdf'} onClick={() => exportAs('pdf')} disabled={!data}>
              Export PDF
            </Button>
          </>
        }
      />
      <div className="no-print mb-6 flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} wrapperClassName="w-44" />
        <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} wrapperClassName="w-44" error={!valid ? '"To" must be after "From"' : undefined} />
      </div>

      {loading && !data ? (
        <SkeletonRows rows={6} />
      ) : error ? (
        <div className="panel"><ErrorState message={error} onRetry={reload} /></div>
      ) : data && s ? (
        <div className="space-y-6">
          <section className="panel p-5">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} dataKey="value" innerRadius={48} outerRadius={70} stroke="none">
                      {pie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-500">
                  {data.business.businessName}, {fmtDate(data.period.from)} to {fmtDate(data.period.to)}
                </p>
                <p className="tabular mt-1 text-4xl font-extrabold text-ledger-700">{s.compliancePercentage}%</p>
                <p className="text-sm text-ink-700">of obligations that fell due were completed</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                  {[
                    ['Obligations', s.total],
                    ['Completed', s.completed],
                    ['On time', s.completedOnTime],
                    ['Open', s.pending],
                    ['Overdue', s.overdue],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <dt className="text-xs text-ink-500">{l}</dt>
                      <dd className={`tabular text-xl font-bold ${l === 'Overdue' && Number(v) > 0 ? 'text-signal-600' : ''}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="border-b border-line px-4 py-3 font-bold">By agency</h2>
            <Table head={['Agency', 'Obligations', 'Completed', 'Overdue']}>
              {data.byAgency.map((a) => (
                <tr key={a.agency} className="block py-2 md:table-row md:py-0">
                  <Td className="font-semibold">{a.agency}</Td>
                  <Td label="Obligations" className="tabular">{a.total}</Td>
                  <Td label="Completed" className="tabular">{a.completed}</Td>
                  <Td label="Overdue" className={`tabular ${a.overdue ? 'text-signal-600' : ''}`}>{a.overdue}</Td>
                </tr>
              ))}
            </Table>
          </section>

          <section className="panel">
            <h2 className="border-b border-line px-4 py-3 font-bold">Obligations in this period</h2>
            {data.tasks.length ? (
              <Table head={['Obligation', 'Agency', 'Period', 'Due', 'Status']}>
                {data.tasks.map((t) => (
                  <tr key={t._id} className="block py-2 md:table-row md:py-0">
                    <Td className="font-semibold">{t.title}</Td>
                    <Td label="Agency">{t.agency}</Td>
                    <Td label="Period">{t.period}</Td>
                    <Td label="Due" className="tabular">{fmtDue(t.dueDate)}</Td>
                    <Td><StatusBadge status={t.status} /></Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No obligations fell in this period" />
            )}
          </section>

          <section className="panel">
            <h2 className="border-b border-line px-4 py-3 font-bold">Filing history</h2>
            {data.filings.length ? (
              <Table head={['Obligation', 'Filed on', 'Reference', 'Status', 'Recorded by']}>
                {data.filings.map((f) => (
                  <tr key={f._id} className="block py-2 md:table-row md:py-0">
                    <Td className="font-semibold">{f.task} <span className="font-normal text-ink-500">({f.period})</span></Td>
                    <Td label="Filed" className="tabular">{fmtDate(f.filingDate)}</Td>
                    <Td label="Ref">{f.referenceNumber || '—'}</Td>
                    <Td label="Status">{f.status.toLowerCase()}</Td>
                    <Td label="By">{f.filedBy}</Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState title="No filings recorded in this period" />
            )}
          </section>
          <p className="text-xs text-ink-500">
            Generated {fmtDate(data.generatedAt)}. Statuses: {Object.values(STATUS_LABEL).join(', ').toLowerCase()}. SME Comply records filings entered by users and does not
            submit them to agencies. Regulatory data may include sample entries; verify with the relevant authority.
          </p>
        </div>
      ) : null}
    </div>
  );
}
