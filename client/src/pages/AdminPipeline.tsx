import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ComposedChart,
  Line,
  Legend,
} from 'recharts';
import { BarChart2, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { ApplicationStatus } from '../types';
import { StatCard } from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import Breadcrumb from '../components/ui/Breadcrumb';
import { formatPercent, getStatusLabel } from '../lib/utils';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: '#94a3b8',
  IN_REVIEW: '#3b82f6',
  APPROVED: '#22c55e',
  DECLINED: '#ef4444',
  CONDITIONALLY_APPROVED: '#f59e0b',
};

export default function AdminPipeline() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: adminApi.getPipelineStats,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const volumeData = stats
    ? (Object.entries(stats.volumeByStatus) as [ApplicationStatus, number][])
        .map(([status, count]) => ({
          name: getStatusLabel(status),
          count,
          status,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Pipeline Analytics' }]}
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <BarChart2 size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pipeline Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Overview of underwriting pipeline performance.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Applications"
          value={stats?.totalApplications ?? 0}
          icon={<BarChart2 size={20} />}
        />
        <StatCard
          label="Approved This Month"
          value={stats?.approvedThisMonth ?? 0}
          icon={<CheckCircle size={20} />}
        />
        <StatCard
          label="Approval Rate"
          value={stats ? formatPercent(stats.approvalRate, 1) : '—'}
          icon={<TrendingUp size={20} />}
        />
        <StatCard
          label="Avg GDS"
          value={stats ? formatPercent(stats.avgGds) : '—'}
          subtext="In Review"
          icon={<Clock size={20} />}
        />
      </div>

      {/* Volume by status bar chart */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-5">
          Applications by Status
        </h2>
        {volumeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '13px',
                }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                {volumeData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status as ApplicationStatus] ?? '#94a3b8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-16 text-slate-400 text-sm">
            No application data available.
          </div>
        )}
      </div>

      {/* Monthly Volume Trend */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-5">Monthly Volume Trend</h2>
        {stats?.monthlyTrend && stats.monthlyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={stats.monthlyTrend}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '13px',
                }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
              />
              <Bar
                dataKey="total"
                name="Total"
                fill="#94a3b8"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
              <Line
                type="monotone"
                dataKey="approved"
                name="Approved"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: '#22c55e' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="declined"
                name="Declined"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: '#ef4444' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-16 text-slate-400 text-sm">
            No monthly trend data available.
          </div>
        )}
      </div>

      {/* Status breakdown table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Status Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Share
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {volumeData.map((row) => {
                const pct =
                  stats && stats.totalApplications > 0
                    ? (row.count / stats.totalApplications) * 100
                    : 0;
                return (
                  <tr key={row.status} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[row.status as ApplicationStatus] ?? '#94a3b8',
                          }}
                        />
                        <span className="font-medium text-slate-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-900">
                      {row.count}
                    </td>
                    <td className="px-6 py-3.5 text-right text-slate-500">
                      {formatPercent(pct, 1)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="w-full bg-slate-100 rounded-full h-2 max-w-[200px]">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor:
                              STATUS_COLORS[row.status as ApplicationStatus] ?? '#94a3b8',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
