/**
 * Module purpose: Renders reusable rows of compliance tasks with consistent status, due-date, and business information.
 */
import { Link } from 'react-router-dom';
import type { ComplianceTask } from '../../types';
import { fmtDue } from '../../lib/format';
import { DueCountdown, PriorityBadge, StatusBadge } from '../ui';

export function TaskRow({ task, showBusiness = false }: { task: ComplianceTask; showBusiness?: boolean }) {
  const business = typeof task.businessId === 'object' ? task.businessId?.businessName : undefined;
  return (
    <li>
      <Link to={`/app/tasks/${task._id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-paper focus-visible:bg-paper sm:gap-5">
        <DueCountdown dueDate={task.dueDate} status={task.status} />
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold ${task.status === 'NOT_APPLICABLE' ? 'text-ink-400' : ''}`}>{task.title}</p>
          <p className="truncate text-sm text-ink-500">
            {task.agencyId?.acronym ? `${task.agencyId.acronym}, ` : ''}
            {task.periodLabel ?? task.period}
            {showBusiness && business ? ` for ${business}` : ''}
            <span className="sm:hidden">, due {fmtDue(task.dueDate)}</span>
          </p>
        </div>
        <div className="hidden w-28 text-sm text-ink-700 sm:block tabular">{fmtDue(task.dueDate)}</div>
        <div className="hidden w-24 md:block">
          <PriorityBadge priority={task.priority} />
        </div>
        <div className="w-28 text-right">
          <StatusBadge status={task.status} />
        </div>
      </Link>
    </li>
  );
}

export function TaskList({ tasks, showBusiness }: { tasks: ComplianceTask[]; showBusiness?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => (
        <TaskRow key={t._id} task={t} showBusiness={showBusiness} />
      ))}
    </ul>
  );
}
