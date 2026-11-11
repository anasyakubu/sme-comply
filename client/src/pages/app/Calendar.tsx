/**
 * Module purpose: Displays compliance deadlines in a calendar. Changing the visible range requests the corresponding tasks from the API.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DatesSetArg, EventInput } from '@fullcalendar/core';
import { format } from 'date-fns';
import { useBusiness } from '../../context/BusinessContext';
import { useApi } from '../../hooks/useApi';
import { errorMessage, get } from '../../lib/api';
import { dueDateOnly } from '../../lib/format';
import type { Agency, ComplianceTask, TaskStatus } from '../../types';
import { ErrorState, PageHeader, Select } from '../../components/ui';
import { NoBusiness } from '../../components/business/NoBusiness';

const COLOURS: Record<TaskStatus, { bg: string; fg: string; border: string }> = {
  UPCOMING: { bg: '#FFFFFF', fg: '#14233B', border: '#A9B1BC' },
  PENDING: { bg: '#FBF3E6', fg: '#93590F', border: '#B8741A' },
  IN_PROGRESS: { bg: '#FFFFFF', fg: '#14233B', border: '#14233B' },
  OVERDUE: { bg: '#B42318', fg: '#FFFFFF', border: '#B42318' },
  COMPLETED: { bg: '#EAF3EE', fg: '#175A3D', border: '#D3E6DB' },
  NOT_APPLICABLE: { bg: '#F6F7F5', fg: '#7D8795', border: '#DDE2DC' },
};

const LEGEND: Array<[TaskStatus, string]> = [
  ['OVERDUE', 'Overdue'],
  ['PENDING', 'Due within 14 days'],
  ['IN_PROGRESS', 'In progress'],
  ['UPCOMING', 'Upcoming'],
  ['COMPLETED', 'Completed'],
];

/**
 * Displays compliance deadlines in a calendar. Changing the visible range requests the corresponding tasks from the API.
 */
export default function CalendarPage() {
  const { current, loading: loadingBusinesses } = useBusiness();
  const navigate = useNavigate();
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [events, setEvents] = useState<EventInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Fetch server data when the current selection or filters change; useApi exposes loading and error states.
  const agencies = useApi(() => get<Agency[]>('/agencies', { limit: 100, active: 'true' }), []);

  const load = useCallback(
    async (r: { from: string; to: string }) => {
      if (!current) return;
      try {
        setError(null);
        const res = await get<ComplianceTask[]>('/compliance-tasks/calendar', { businessId: current._id, from: r.from, to: r.to, status, agencyId });
        setEvents(
          res.data.map((t) => {
            const c = COLOURS[t.status];
            return {
              id: t._id,
              title: `${t.agencyId?.acronym ? `${t.agencyId.acronym}: ` : ''}${t.title}`,
              start: format(dueDateOnly(t.dueDate), 'yyyy-MM-dd'),
              allDay: true,
              backgroundColor: c.bg,
              textColor: c.fg,
              borderColor: c.border,
            };
          }),
        );
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [current, status, agencyId],
  );

  // Use the calendar’s visible date interval as the task API query window.
  const onDates = (arg: DatesSetArg) => {
    const r = { from: format(arg.start, 'yyyy-MM-dd'), to: format(arg.end, 'yyyy-MM-dd') };
    setRange(r);
    void load(r);
  };

  if (!loadingBusinesses && !current) return <NoBusiness />;

  return (
    <div>
      <PageHeader title="Calendar" description="Deadlines by date. Select one to open it." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:w-96">
          <Select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="All statuses"
            options={LEGEND.map(([value, label]) => ({ value, label }))}
          />
          <Select
            aria-label="Agency"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            placeholder="All agencies"
            options={(agencies.data ?? []).map((a) => ({ value: a._id, label: a.acronym }))}
          />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700" aria-label="Legend">
          {LEGEND.map(([s, label]) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border" style={{ background: COLOURS[s].bg, borderColor: COLOURS[s].border }} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
      {error && <ErrorState message={error} onRetry={() => range && void load(range)} />}
      <div className="panel p-3 sm:p-4">
        <FullCalendar
          key={`${current?._id}-${status}-${agencyId}`}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView={window.innerWidth < 640 ? 'listMonth' : 'dayGridMonth'}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' }}
          buttonText={{ today: 'Today', month: 'Month', list: 'List' }}
          firstDay={1}
          height="auto"
          dayMaxEvents={3}
          events={events}
          datesSet={onDates}
          eventClick={(info) => navigate(`/app/tasks/${info.event.id}`)}
        />
      </div>
    </div>
  );
}
