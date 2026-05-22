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
} from 'recharts';
import { BarChart2, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { ApplicationStatus } from '../types';
import { StatCard } from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import { formatPercent, getStatusLabel } from '../lib/utils';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  DRAFT: '#E8E6E1',
  IN_REVIEW: '#93C5FD',
  APPROVED: '#1B4332',
  DECLINED: '#991B1B',
  CONDITIONALLY_APPROVED: '#92400E',
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
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#D1FAE5] rounded-lg">
          <BarChart2 size={20} className="text-[#1B4332]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1916]">Pipeline Analytics</h1>
          <p className="text-sm text-[#6B6860] mt-0.5">
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
      <div className="bg-white rounded-xl shadow-sm border border-[#E8E6E1] p-6">
        <h2 className="text-base font-semibold text-[#1A1916] mb-5">
          Applications by Status
        </h2>
        {volumeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E6E1" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6B6860' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6B6860' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1916',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#F7F6F3',
                  fontSize: '13px',
                }}
                cursor={{ fill: '#F7F6F3' }}
              />
              <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                {volumeData.map((entry) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status as ApplicationStatus] ?? '#E8E6E1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-16 text-[#6B6860] text-sm">
            No application data available.
          </div>
        )}
      </div>

      {/* Status breakdown table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E8E6E1] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8E6E1]">
          <h2 className="text-base font-semibold text-[#1A1916]">Status Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6F3]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#6B6860] uppercase tracking-wider">
                  Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#6B6860] uppercase tracking-wider">
                  Share
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wider">
                  Distribution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E6E1]">
              {volumeData.map((row) => {
                const pct =
                  stats && stats.totalApplications > 0
                    ? (row.count / stats.totalApplications) * 100
                    : 0;
                return (
                  <tr key={row.status} className="hover:bg-[#F7F6F3] transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              STATUS_COLORS[row.status as ApplicationStatus] ?? '#E8E6E1',
                          }}
                        />
                        <span className="font-medium text-[#1A1916]">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-[#1A1916]">
                      {row.count}
                    </td>
                    <td className="px-6 py-3.5 text-right text-[#6B6860]">
                      {formatPercent(pct, 1)}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="w-full bg-[#E8E6E1] rounded-full h-2 max-w-[200px]">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            backgroundColor:
                              STATUS_COLORS[row.status as ApplicationStatus] ?? '#E8E6E1',
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
