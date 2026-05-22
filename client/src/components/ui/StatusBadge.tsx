import { cn, getStatusColor, getStatusLabel } from '../../lib/utils';
import type { ApplicationStatus } from '../../types';

interface StatusBadgeProps {
  status: ApplicationStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        getStatusColor(status),
        className
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
