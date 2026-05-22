import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useApplications } from '../hooks/useApplication';
import type { ApplicationStatus } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatPercent, getPrimaryBorrower, cn } from '../lib/utils';

const STATUS_TABS: { label: string; value: ApplicationStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Conditional', value: 'CONDITIONALLY_APPROVED' },
  { label: 'Declined', value: 'DECLINED' },
];

const PAGE_SIZE = 15;

export default function ApplicationList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    const t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, []);

  const { data, isLoading, isFetching } = useApplications({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1916]">Files</h1>
          <p className="text-sm text-[#6B6860] mt-0.5">
            {data ? `${data.total} total applications` : ' '}
          </p>
        </div>
        <Link
          to="/applications/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#1B4332] text-[#1B4332] text-sm font-medium hover:bg-[#D1FAE5] transition-colors"
        >
          <Plus size={14} />
          New Application
        </Link>
      </div>

      {/* Card */}
      <div className="card overflow-hidden">
        {/* Search + status filters */}
        <div className="px-5 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6860]" />
              <input
                type="text"
                placeholder="Search by file # or borrower…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E8E6E1] rounded-lg bg-white text-[#1A1916] placeholder:text-[#6B6860] focus:outline-none focus:border-[#1B4332]"
              />
            </div>
            {isFetching && <Spinner size="sm" />}
          </div>

          {/* Status tabs */}
          <div className="flex gap-0 border-b border-[#E8E6E1] overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatus(tab.value); setPage(1); }}
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  status === tab.value
                    ? 'border-[#1B4332] text-[#1B4332]'
                    : 'border-transparent text-[#6B6860] hover:text-[#1A1916]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-16">
            <p className="text-sm text-[#6B6860]">No applications found.</p>
            <Link to="/import" className="mt-3 inline-flex items-center gap-1 text-sm text-[#1B4332] font-medium">
              Import a deal <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E6E1]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide">File #</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide">Borrower</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden md:table-cell">Assigned To</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden lg:table-cell">LTV</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden sm:table-cell">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.data.map((app) => {
                  const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
                  const latestDecision = app.decisions[app.decisions.length - 1];
                  return (
                    <tr key={app.id} className="border-b border-[#E8E6E1] last:border-0 hover:bg-[#F7F6F3] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-[#6B6860]">{app.fileNumber}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[#1A1916]">
                          {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                        </p>
                        {app.borrowers.length > 1 && (
                          <p className="text-xs text-[#6B6860] mt-0.5">+{app.borrowers.length - 1} co-borrower</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-[#6B6860]">
                        {app.assignedTo
                          ? `${app.assignedTo.firstName} ${app.assignedTo.lastName}`
                          : <span className="text-[#E8E6E1]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-xs text-[#6B6860]">
                        {latestDecision ? formatPercent(latestDecision.ltv) : '—'}
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-[#6B6860] text-xs">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/applications/${app.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E6E1] text-xs font-medium text-[#1A1916] hover:border-[#1B4332] hover:text-[#1B4332] transition-colors"
                        >
                          View <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#E8E6E1]">
            <p className="text-xs text-[#6B6860]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8E6E1] text-xs font-medium text-[#1A1916] hover:border-[#1B4332] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="text-xs text-[#6B6860] font-mono">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8E6E1] text-xs font-medium text-[#1A1916] hover:border-[#1B4332] disabled:opacity-40 transition-colors"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
