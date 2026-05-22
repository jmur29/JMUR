import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import {
  FileText, CheckCircle, Clock, TrendingUp,
  Sparkles, ChevronRight, ArrowUpRight,
} from 'lucide-react';
import { applicationsApi, adminApi } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatPercent, getPrimaryBorrower } from '../lib/utils';
import { cn } from '../lib/utils';

function StatCard({ label, value, sub, icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const [assignedToMe, setAssignedToMe] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: adminApi.getPipelineStats,
  });

  const { data: recentData, isLoading: appsLoading } = useQuery({
    queryKey: ['applications', 'dashboard', { assignedToMe }],
    queryFn: () => applicationsApi.list({ page: 1, pageSize: 8, assignedToMe }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good day, {user?.firstName ?? 'Underwriter'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's your mortgage pipeline.</p>
        </div>
        <Link
          to="/applications/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:opacity-95 transition-all"
        >
          <Sparkles size={15} />
          New Submission
          <ChevronRight size={15} />
        </Link>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Files"
            value={stats?.totalApplications ?? 0}
            icon={<FileText size={18} className="text-violet-600" />}
            color="bg-violet-50"
          />
          <StatCard
            label="Approved This Month"
            value={stats?.approvedThisMonth ?? 0}
            icon={<CheckCircle size={18} className="text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            label="In Review"
            value={stats?.inReview ?? 0}
            icon={<Clock size={18} className="text-amber-600" />}
            color="bg-amber-50"
          />
          <StatCard
            label="Avg GDS"
            value={stats ? formatPercent(stats.avgGds) : '—'}
            sub={`Approval rate: ${stats ? formatPercent(stats.approvalRate, 1) : '—'}`}
            icon={<TrendingUp size={18} className="text-blue-600" />}
            color="bg-blue-50"
          />
        </div>
      )}

      {/* Recent applications */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Recent Files</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(e) => setAssignedToMe(e.target.checked)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              Assigned to me
            </label>
            <Link to="/applications" className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>

        {appsLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : !recentData?.data.length ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <FileText size={20} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">No applications yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Drop in a submission to get started</p>
            </div>
            <Link
              to="/applications/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold shadow-sm hover:opacity-95 transition-all"
            >
              <Sparkles size={13} /> New Submission
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentData.data.map((app) => {
              const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
              const latest = app.decisions?.[0];
              return (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{app.fileNumber}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                    {latest && (
                      <div className="text-right">
                        <p className="text-xs text-slate-400">GDS / TDS</p>
                        <p className="text-xs font-semibold text-slate-700">
                          {formatPercent(Number(latest.gds))} / {formatPercent(Number(latest.tds))}
                        </p>
                      </div>
                    )}
                    <StatusBadge status={app.status} />
                    <span className="text-xs text-slate-400">{formatDate(app.createdAt)}</span>
                  </div>
                  <ArrowUpRight size={15} className="text-slate-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
