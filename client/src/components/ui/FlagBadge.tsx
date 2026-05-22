import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn, getFlagColor } from '../../lib/utils';
import type { FlagType } from '../../types';

interface FlagBadgeProps {
  type: FlagType;
  message: string;
  field?: string;
  className?: string;
}

const iconMap = {
  PASS: CheckCircle,
  WARN: AlertTriangle,
  FAIL: XCircle,
  INFO: Info,
};

const iconColorMap: Record<FlagType, string> = {
  PASS: 'text-green-500',
  WARN: 'text-amber-500',
  FAIL: 'text-red-500',
  INFO: 'text-blue-500',
};

export default function FlagBadge({ type, message, field, className }: FlagBadgeProps) {
  const Icon = iconMap[type];
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
        getFlagColor(type),
        className
      )}
    >
      <Icon size={16} className={cn('mt-0.5 flex-shrink-0', iconColorMap[type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{message}</p>
        {field && <p className="text-xs opacity-70 mt-0.5">{field}</p>}
      </div>
    </div>
  );
}
