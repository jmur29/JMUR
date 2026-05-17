import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  ExternalLink,
  Plus,
  BarChart2,
  BookOpen,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { applicationsApi, adminApi } from '../lib/api';
import { StatCard } from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import Tabs from '../components/ui/Tabs';
import { formatDate, formatPercent, getPrimaryBorrower, cn } from '../lib/utils';
import { usePermissions } from '../hooks/usePermissions';
import type { ApplicationStatus } from '../types';
import BrokerDashboard from '../components/dashboard/BrokerDashboard';
import LenderDashboard from '../components/dashboard/LenderDashboard';

// ─── GDS ratio pill ───────────────────────────────────────────────────────────

function GdsPill({ gds }: { gds: number }) {
  const cls =
    gds < 35
      ? 'bg-green-100 text-green-700'
      : gds <= 39
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', cls)}>
      {gds.toFixed(1)}%
    </span>
  );
}

// ─── Status distribution chart ────────────────────────────────────────────────

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  DRAFT: '#94a3b8',
  READY_TO_SUBMIT: '#6366f1',
  SUBMITTED: '#8b5cf6',
  IN_REVIEW: '#3b82f6',
  APPROVED: '#22c55e',
  CONDITIONALLY_APPROVED: '#f59e0b',
  DECLINED: '#ef4444',
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  READY_TO_SUBMIT: 'Ready',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  CONDITIONALLY_APPROVED: 'Conditional',
  DECLINED: 'Declined',
};

interface ChartDatum {
  status: ApplicationStatus;
  label: string;
  count: number;
  color: string;
}

function StatusDistributionChart({
  volumeByStatus,
}: {
  volumeByStatus: Partial<Record<ApplicationStatus, number>>;
}) {
  const data: ChartDatum[] = (
    Object.entries(volumeByStatus) as [ApplicationStatus, number][]
  )
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      label: STATUS_LABEL[status],
      count,
      color: STATUS_COLOR[status],
    }));

  if (!data.length) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-6 py-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Volume by Status</h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Files']}
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Quick Actions bar ────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const actions: {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    adminOnly?: boolean;
  }[] = [
    {
      label: 'New Application',
      icon: <Plus size={18} />,
      onClick: () => navigate('/applications/new'),
    },
    {
      label: 'Run Report',
      icon: <BarChart2 size={18} />,
      onClick: () => navigate('/admin/pipeline'),
    },
    {
      label: 'Audit Log',
      icon: <BookOpen size={18} />,
      onClick: () => navigate('/admin/audit'),
      adminOnly: true,
    },
  ];

  const visible = actions.filter((a) => !a.adminOnly || isAdmin);

  return (
    <div className="flex flex-wrap gap-3">
      {visible.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
        >
          <span className="text-slate-400 group-hover:text-blue-500">{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ─── Pipeline view (ADMIN / VIEWER default) ───────────────────────────────────

function AdminPipelineView({
  assignedToMe,
  setAssignedToMe,
}: {
  assignedToMe: boolean;
  setAssignedToMe: (v: boolean) => void;
}) {
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

      {/* Quick Actions */}
      <QuickActions />

      {/* Status distribution chart */}
      {stats?.volumeByStatus && (
        <StatusDistributionChart volumeByStatus={stats.volumeByStatus} />
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
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Age
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    GDS
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
                  const latestDecision = app.decisions[app.decisions.length - 1];
                  const age = formatDistanceToNow(parseISO(app.createdAt), { addSuffix: false });
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
                      <td className="px-6 py-3.5 text-slate-400 text-xs hidden md:table-cell">
                        {age}
                      </td>
                      <td className="px-6 py-3.5 hidden lg:table-cell">
                        {latestDecision ? (
                          <GdsPill gds={latestDecision.gds} />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useUser();
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [adminTab, setAdminTab] = useState<'broker' | 'lender' | 'pipeline'>('pipeline');
  const { role, isAdmin } = usePermissions();

  // Broker persona
  if (role === 'BROKER') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {user?.firstName ?? 'Broker'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your mortgage pipeline overview.</p>
        </div>
        <BrokerDashboard />
      </div>
    );
  }

  // Underwriter persona
  if (role === 'UNDERWRITER') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {user?.firstName ?? 'Underwriter'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Review queue and pipeline overview.</p>
        </div>
        <LenderDashboard />
      </div>
    );
  }

  // ADMIN: full multi-persona view
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Welcome back, {user?.firstName ?? 'Admin'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">Full pipeline & persona overview.</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <Tabs
            tabs={[
              { id: 'pipeline', label: 'Pipeline' },
              { id: 'broker', label: 'Broker View' },
              { id: 'lender', label: 'Lender View' },
            ]}
            activeTab={adminTab}
            onChange={(id) => setAdminTab(id as 'broker' | 'lender' | 'pipeline')}
            className="px-4"
          />
          <div className="p-6">
            {adminTab === 'broker' && <BrokerDashboard />}
            {adminTab === 'lender' && <LenderDashboard />}
            {adminTab === 'pipeline' && (
              <AdminPipelineView assignedToMe={assignedToMe} setAssignedToMe={setAssignedToMe} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // VIEWER: default pipeline view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {user?.firstName ?? 'Viewer'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Here's an overview of the mortgage pipeline.
          </p>
        </div>
        <Link to="/applications/new">
          <Button leftIcon={<FileText size={16} />}>New Application</Button>
        </Link>
      </div>
      <AdminPipelineView assignedToMe={assignedToMe} setAssignedToMe={setAssignedToMe} />
    </div>
  );
}
