import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ExternalLink, Download, FileText } from 'lucide-react';
import { useApplications } from '../hooks/useApplication';
import type { ApplicationStatus } from '../types';
import { adminApi } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Pagination from '../components/ui/Pagination';
import Breadcrumb from '../components/ui/Breadcrumb';
import { formatDate, formatPercent, getPrimaryBorrower, downloadFile, cn } from '../lib/utils';
import { format } from 'date-fns';

const STATUS_TABS: { label: string; value: ApplicationStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Conditionally Approved', value: 'CONDITIONALLY_APPROVED' },
  { label: 'Declined', value: 'DECLINED' },
];

const PAGE_SIZE = 15;

export default function ApplicationList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search (300 ms)
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const { data, isLoading, isFetching } = useApplications({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const hasActiveFilters = !!(debouncedSearch || status);

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const csv = await adminApi.exportPipeline({ status: status || undefined });
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      downloadFile(csv, `clearpath-pipeline-${dateStr}.csv`);
    } finally {
      setExportLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatus('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Applications' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {data ? `${data.total} application${data.total === 1 ? '' : 's'}` : 'Applications'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage and review mortgage files.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={14} />}
            loading={exportLoading}
            onClick={handleExport}
          >
            Export CSV
          </Button>
          <Link to="/applications/new">
            <Button leftIcon={<Plus size={16} />}>New Application</Button>
          </Link>
        </div>
      </div>

      {/* Filters + Table */}
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
          <div className="flex flex-col items-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <FileText size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium mb-1">No applications found</p>
            <p className="text-slate-400 text-sm mb-4">
              {hasActiveFilters
                ? 'No results match the current filters.'
                : 'Get started by creating your first application.'}
            </p>
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Link to="/applications/new">
                <Button leftIcon={<Plus size={14} />} size="sm">
                  Create your first application
                </Button>
              </Link>
            )}
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
        {data && data.total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
