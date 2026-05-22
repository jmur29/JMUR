import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useApplications } from '../hooks/useApplication';
import type { ApplicationStatus } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatPercent, getPrimaryBorrower } from '../lib/utils';
import { cn } from '../lib/utils';

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

  // Debounce search
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
          <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data ? `${data.total} total applications` : ' '}
          </p>
        </div>
        <Link to="/applications/new">
          <Button leftIcon={<Plus size={16} />}>New Application</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search by file # or borrower…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {isFetching && <Spinner size="sm" />}
        </div>

        {/* Status tabs */}
        <div className="px-6 border-b border-slate-100 flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={cn(
                'whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition-colors',
                status === tab.value
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-sm">No applications found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    File #
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    LTV
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((app) => {
                  const primary = app.borrowers.length
                    ? getPrimaryBorrower(app.borrowers)
                    : null;
                  const latestDecision = app.decisions[app.decisions.length - 1];
                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">
                        {app.fileNumber}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                        </p>
                        {app.borrowers.length > 1 && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            +{app.borrowers.length - 1} co-borrower
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-slate-600">
                        {app.assignedTo
                          ? `${app.assignedTo.firstName} ${app.assignedTo.lastName}`
                          : <span className="text-slate-300">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-slate-600">
                        {latestDecision ? formatPercent(latestDecision.ltv) : '—'}
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell text-slate-500">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <Link to={`/applications/${app.id}`}>
                          <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={<ExternalLink size={13} />}
                          >
                            View
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

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<ChevronLeft size={14} />}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="text-sm text-slate-600">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                rightIcon={<ChevronRight size={14} />}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
