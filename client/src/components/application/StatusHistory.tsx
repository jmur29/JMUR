import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { applicationsApi } from '../../lib/api';
import type { ApplicationStatus } from '../../types';
import { cn, getStatusLabel } from '../../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_DOT_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: 'bg-slate-400',
  IN_REVIEW: 'bg-blue-500',
  APPROVED: 'bg-green-500',
  DECLINED: 'bg-red-500',
  CONDITIONALLY_APPROVED: 'bg-amber-500',
};

function statusDotColor(status: ApplicationStatus): string {
  return STATUS_DOT_COLORS[status] ?? 'bg-slate-400';
}

function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-3 h-3 rounded-full bg-slate-200 mt-1 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── StatusHistory ────────────────────────────────────────────────────────────

interface StatusHistoryProps {
  applicationId: string;
}

export default function StatusHistory({ applicationId }: StatusHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['status-history', applicationId],
    queryFn: () => applicationsApi.getHistory(applicationId),
    enabled: !!applicationId,
  });

  if (isLoading) {
    return <HistorySkeleton />;
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-4">No status changes yet.</p>
    );
  }

  // Newest first
  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="relative">
      {/* Vertical connecting line */}
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-200" />

      <div className="space-y-4">
        {sorted.map((entry) => {
          const changedByName = entry.changedBy
            ? `${entry.changedBy.firstName} ${entry.changedBy.lastName}`.trim()
            : 'Unknown';
          return (
            <div key={entry.id} className="flex gap-3 items-start pl-0">
              {/* Dot */}
              <span
                className={cn(
                  'w-3 h-3 rounded-full flex-shrink-0 mt-1 ring-2 ring-white z-10',
                  statusDotColor(entry.toStatus)
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  {entry.fromStatus && (
                    <>
                      <span className="text-xs text-slate-500">{getStatusLabel(entry.fromStatus)}</span>
                      <ArrowRight size={11} className="text-slate-400 flex-shrink-0" />
                    </>
                  )}
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      entry.toStatus === 'APPROVED'
                        ? 'text-green-700'
                        : entry.toStatus === 'DECLINED'
                        ? 'text-red-700'
                        : entry.toStatus === 'IN_REVIEW'
                        ? 'text-blue-700'
                        : entry.toStatus === 'CONDITIONALLY_APPROVED'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    )}
                  >
                    {getStatusLabel(entry.toStatus)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {changedByName} · {formatRelative(entry.createdAt)}
                </p>
                {entry.note && (
                  <p className="text-xs text-slate-500 mt-1 italic">{entry.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
