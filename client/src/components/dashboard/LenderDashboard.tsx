import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  ClipboardList,
  AlertTriangle,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { applicationsApi, aiApi, dashboardApi } from '../../lib/api';
import { formatDate, getPrimaryBorrower, cn } from '../../lib/utils';
import { StatCard } from '../ui/Card';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import GDSTDSIndicator from '../ui/GDSTDSIndicator';
import ApplicationStatusPill from '../ui/ApplicationStatusPill';
import type { Application, FraudSeverity } from '../../types';

const SEVERITY_CONFIG: Record<FraudSeverity, { label: string; badgeClass: string; rowClass: string }> = {
  HIGH: {
    label: 'High',
    badgeClass: 'bg-red-100 text-red-700',
    rowClass: 'bg-red-50 border-red-200',
  },
  MEDIUM: {
    label: 'Medium',
    badgeClass: 'bg-amber-100 text-amber-700',
    rowClass: 'bg-amber-50 border-amber-200',
  },
  LOW: {
    label: 'Low',
    badgeClass: 'bg-slate-100 text-slate-600',
    rowClass: 'bg-slate-50 border-slate-200',
  },
};

// ─── Fraud Signal Summary Panel ───────────────────────────────────────────────

function FraudSummaryPanel({ applicationId }: { applicationId: string }) {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['fraud-signals', applicationId],
    queryFn: () => aiApi.getFraudSignals(applicationId),
  });

  if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>;
  if (!signals || signals.length === 0) return null;

  const grouped: Record<FraudSeverity, typeof signals> = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const s of signals) grouped[s.severity].push(s);

  return (
    <div className="space-y-2 mt-2">
      {(['HIGH', 'MEDIUM', 'LOW'] as FraudSeverity[]).map((sev) => {
        const group = grouped[sev];
        if (group.length === 0) return null;
        const cfg = SEVERITY_CONFIG[sev];

        return (
          <div key={sev} className={cn('rounded-lg border p-3 space-y-2', cfg.rowClass)}>
            <p className={cn('text-xs font-semibold', sev === 'HIGH' ? 'text-red-700' : sev === 'MEDIUM' ? 'text-amber-700' : 'text-slate-600')}>
              {cfg.label} Severity ({group.length})
              {sev === 'HIGH' && !group.every((s) => s.acknowledgedAt) && (
                <span className="ml-2 text-red-600 font-normal">· Requires acknowledgment</span>
              )}
            </p>
            {group.map((signal) => (
              <div key={signal.id} className="text-xs text-slate-700 space-y-0.5">
                <p className="font-medium">{signal.signalType} — {signal.documentName}</p>
                <p className="text-slate-600 line-clamp-2">{signal.evidence}</p>
                <p className="text-slate-500 italic">{signal.recommendedAction}</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Review Queue Row ────────────────────────────────────────────────────────

function ReviewRow({ app }: { app: Application }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const approveMutation = useMutation({
    mutationFn: () => applicationsApi.update(app.id, { status: 'APPROVED' }),
    onSuccess: () => {
      toast.success('Application approved');
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: () => toast.error('Failed to approve'),
  });

  const declineMutation = useMutation({
    mutationFn: () => applicationsApi.update(app.id, { status: 'DECLINED' }),
    onSuccess: () => {
      toast.success('Application declined');
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
    onError: () => toast.error('Failed to decline'),
  });

  const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
  const latestDecision = app.decisions[app.decisions.length - 1];

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 font-medium text-slate-900">
          {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
          <p className="text-xs font-mono text-slate-400">{app.fileNumber}</p>
        </td>
        <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
          {app.property ? `${app.property.city}, ${app.property.province}` : '—'}
        </td>
        <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
          {app.assignedTo ? `${app.assignedTo.firstName} ${app.assignedTo.lastName}` : '—'}
        </td>
        <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
          {formatDate(app.updatedAt)}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {latestDecision ? (
            <GDSTDSIndicator gds={latestDecision.gds} tds={latestDecision.tds} compact />
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <ApplicationStatusPill status={app.status} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Link to={`/applications/${app.id}?tab=credit-memo`}>
              <Button size="sm" variant="ghost" leftIcon={<ExternalLink size={13} />}>
                Memo
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
            >
              Fraud
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ThumbsUp size={13} />}
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
              className="text-green-600 hover:text-green-700"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<ThumbsDown size={13} />}
              loading={declineMutation.isPending}
              onClick={() => declineMutation.mutate()}
              className="text-red-600 hover:text-red-700"
            >
              Decline
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-6 pb-4 bg-slate-50">
            <FraudSummaryPanel applicationId={app.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── LenderDashboard ──────────────────────────────────────────────────────────

export default function LenderDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['lender-stats'],
    queryFn: dashboardApi.getLenderStats,
  });

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ['applications', 'lender-review'],
    queryFn: () => applicationsApi.list({ status: 'IN_REVIEW', pageSize: 50 }),
  });

  const applications = appsData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 h-28 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Files In Review" value={stats?.filesInReview ?? 0} icon={<ClipboardList size={20} />} />
          <StatCard label="Approved This Month" value={stats?.approvedThisMonth ?? 0} icon={<CheckCircle size={20} />} />
          <StatCard label="Manual Review Queue" value={stats?.manualReviewQueue ?? 0} icon={<FileText size={20} />} />
          <StatCard
            label="High Fraud Signals"
            value={stats?.highSeverityFraudSignals ?? 0}
            icon={<AlertTriangle size={20} />}
          />
        </div>
      )}

      {/* Review Queue Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Review Queue</h2>
          <p className="text-xs text-slate-500 mt-0.5">Applications currently in review</p>
        </div>

        {appsLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={32} className="mx-auto text-green-300 mb-3" />
            <p className="text-slate-500 text-sm">No applications currently in review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Borrower</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Property</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Submitted By</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Submitted At</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">GDS/TDS</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Decision</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <ReviewRow key={app.id} app={app} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
