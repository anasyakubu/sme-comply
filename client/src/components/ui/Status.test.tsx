/**
 * Module purpose: Verifies that task statuses and deadline countdown badges communicate the correct state.
 */
import { render, screen } from '@testing-library/react';
import { DueCountdown, StatusBadge } from './Status';

const iso = (offsetDays: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays)).toISOString();
};

describe('DueCountdown', () => {
  it('shows days left', () => {
    render(<DueCountdown dueDate={iso(5)} status="PENDING" />);
    expect(screen.getByLabelText('5 days left')).toBeInTheDocument();
  });

  it('shows days late for overdue items', () => {
    render(<DueCountdown dueDate={iso(-1)} status="OVERDUE" />);
    expect(screen.getByLabelText('1 day late')).toBeInTheDocument();
  });

  it('shows a tick for completed items', () => {
    render(<DueCountdown dueDate={iso(-10)} status="COMPLETED" />);
    expect(screen.getByLabelText('done')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('uses plain-language labels', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('Due soon')).toBeInTheDocument();
  });
});
