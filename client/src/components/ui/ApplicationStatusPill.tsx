import { cn } from '../../lib/utils';
import type { ApplicationStatus } from '../../types';

interface ApplicationStatusPillProps {
  status: ApplicationStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700' },
  READY_TO_SUBMIT: { label: 'Ready to Submit', className: 'bg-blue-100 text-blue-700' },
  SUBMITTED: { label: 'Submitted', className: 'bg-indigo-100 text-indigo-700' },
  IN_REVIEW: { label: 'In Review', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  DECLINED: { label: 'Declined', className: 'bg-red-100 text-red-700' },
  CONDITIONALLY_APPROVED: { label: 'Conditionally Approved', className: 'bg-orange-100 text-orange-700' },
};

export default function ApplicationStatusPill({ status, className }: ApplicationStatusPillProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
