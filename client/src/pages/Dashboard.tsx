import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { FileText, CheckCircle, Clock, TrendingUp, ExternalLink } from 'lucide-react';
import { applicationsApi, adminApi } from '../lib/api';
import { StatCard } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import { formatDate, formatPercent, getPrimaryBorrower } from '../lib/utils';

export default function Dashboard() {
  const { user } = useUser();
  const [assignedToMe, setAssignedToMe] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: adminApi.getPipelineStats,
  });

  const { data: recentData, isLoading: appsLoading } = useQuery({
    queryKey: ['applications', 'dashboard', { assignedToMe }],
    queryFn: () =>
      applicationsApi.list({
        page: 1,
        pageSize: 10,
        assignedToMe,
      }),
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {user?.firstName ?? 'Underwriter'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's an overview of your mortgage pipeline.
          </p>
        </div>
        <Link to="/applications/new">
          <Button leftIcon={<FileText size={16} />}>New Application</Button>
        </Link>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 h-28 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Files"
            value={stats?.totalApplications ?? 0}
            icon={<FileText size={20} />}
          />
          <StatCard
            label="Approved This Month"
            value={stats?.approvedThisMonth ?? 0}
            icon={<CheckCircle size={20} />}
          />
          <StatCard
            label="In Review"
            value={stats?.inReview ?? 0}
            icon={<Clock size={20} />}
          />
          <StatCard
            label="Avg GDS"
            value={stats ? formatPercent(stats.avgGds) : '—'}
            subtext={`Approval rate: ${stats ? formatPercent(stats.approvalRate, 1) : '—'}`}
            icon={<TrendingUp size={20} />}
          />
        </div>
      )}

      {/* Recent applications */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Recent Applications</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={assignedToMe}
                onChange={(e) => setAssignedToMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Assigned to me
            </label>
            <Link to="/applications" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all
            </Link>
          </div>
        </div>

        {appsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : !recentData?.data.length ? (
          <div className="text-center py-12">
            <FileText size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No applications found.</p>
            <Link to="/applications/new" className="mt-3 inline-block">
              <Button size="sm">Create your first application</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    File #
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentData.data.map((app) => {
                  const primary = app.borrowers.length
                    ? getPrimaryBorrower(app.borrowers)
                    : null;
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                        {app.fileNumber}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-slate-900">
                        {primary
                          ? `${primary.firstName} ${primary.lastName}`
                          : '—'}
                      </td>
                      <td className="px-6 py-3.5">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 hidden sm:table-cell">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-6 py-3.5">
                        <Link to={`/applications/${app.id}`}>
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<ExternalLink size={14} />}
                          >
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
