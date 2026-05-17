import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ExternalLink, Download, FileText, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useApplications } from '../hooks/useApplication';
import type { ApplicationStatus, UserRole } from '../types';
import { adminApi, applicationsApi } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import Pagination from '../components/ui/Pagination';
import Breadcrumb from '../components/ui/Breadcrumb';
import { formatDate, formatPercent, getPrimaryBorrower, downloadFile, cn } from '../lib/utils';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = 'date_desc' | 'date_asc' | 'fileNumber' | 'borrowerName' | 'status';

interface SortOption {
  label: string;
  value: SortField;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Date (newest first)', value: 'date_desc' },
  { label: 'Date (oldest first)', value: 'date_asc' },
  { label: 'File Number', value: 'fileNumber' },
  { label: 'Borrower Name', value: 'borrowerName' },
  { label: 'Status', value: 'status' },
];

// ─── Status tabs ──────────────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: ApplicationStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Conditionally Approved', value: 'CONDITIONALLY_APPROVED' },
  { label: 'Declined', value: 'DECLINED' },
];

const PAGE_SIZE = 15;

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null;

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc') return <ChevronUp size={13} className="inline ml-0.5" />;
  if (dir === 'desc') return <ChevronDown size={13} className="inline ml-0.5" />;
  return <ChevronsUpDown size={13} className="inline ml-0.5 text-slate-300" />;
}

// ─── Inline assignee dropdown ─────────────────────────────────────────────────

interface InlineAssignProps {
  applicationId: string;
  currentAssigneeId: string | null;
  currentAssigneeName: string | null;
  underwriters: { id: string; firstName: string; lastName: string; role: UserRole }[];
}

function InlineAssign({ applicationId, currentAssigneeId, currentAssigneeName, underwriters }: InlineAssignProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      applicationsApi.update(applicationId, { assignedToId: assignedToId ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Assignee updated');
      setOpen(false);
    },
    onError: () => toast.error('Failed to update assignee'),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className="text-left text-sm text-slate-600 hover:text-blue-600 hover:underline cursor-pointer focus:outline-none"
        title="Click to reassign"
      >
        {currentAssigneeName ?? <span className="text-slate-300">Unassigned</span>}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-sm">
          <button
            className={cn(
              'w-full text-left px-3 py-2 hover:bg-slate-50',
              currentAssigneeId === null ? 'font-semibold text-blue-600' : 'text-slate-500'
            )}
            onClick={() => mutation.mutate(null)}
          >
            Unassigned
          </button>
          {underwriters.map((u) => (
            <button
              key={u.id}
              className={cn(
                'w-full text-left px-3 py-2 hover:bg-slate-50',
                currentAssigneeId === u.id ? 'font-semibold text-blue-600' : 'text-slate-700'
              )}
              onClick={() => mutation.mutate(u.id)}
            >
              {u.firstName} {u.lastName}
            </button>
          ))}
          {mutation.isPending && (
            <div className="px-3 py-2 text-slate-400 text-xs">Saving…</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  onAssign,
  onChangeStatus,
  onExport,
  onClear,
}: {
  count: number;
  onAssign: () => void;
  onChangeStatus: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-blue-50 border-b border-blue-100">
      <span className="text-sm font-medium text-blue-700">{count} selected</span>
      <Button size="sm" variant="secondary" onClick={onAssign}>
        Assign to…
      </Button>
      <Button size="sm" variant="secondary" onClick={onChangeStatus}>
        Change status to…
      </Button>
      <Button size="sm" variant="secondary" onClick={onExport}>
        Export selected
      </Button>
      <button
        className="ml-auto text-xs text-slate-500 hover:text-slate-700"
        onClick={onClear}
      >
        Clear selection
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ApplicationList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date_desc');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  // Users for assignee filter/inline assign
  const { data: usersData } = useQuery({
    queryKey: ['admin', 'users', { page: 1, pageSize: 100 }],
    queryFn: () => adminApi.listUsers({ page: 1, pageSize: 100 }),
  });

  const underwriters = (usersData?.data ?? []).filter(
    (u) => u.role === 'UNDERWRITER' || u.role === 'ADMIN'
  );

  const hasActiveFilters = !!(debouncedSearch || status || assigneeFilter);

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
    setAssigneeFilter('');
    setPage(1);
  };

  // ─── Sorting ───────────────────────────────────────────────────────────────

  type AppRow = NonNullable<typeof data>['data'][number];

  // Column header click cycles through sort options for that column
  function handleColumnSort(field: 'fileNumber' | 'borrowerName' | 'status') {
    setSortField(field);
    setPage(1);
  }

  function handleDateSort() {
    setSortField((prev) => (prev === 'date_desc' ? 'date_asc' : 'date_desc'));
    setPage(1);
  }

  function sortedData(rows: AppRow[]): AppRow[] {
    return [...rows].sort((a, b) => {
      const primaryA = a.borrowers.length ? getPrimaryBorrower(a.borrowers) : null;
      const primaryB = b.borrowers.length ? getPrimaryBorrower(b.borrowers) : null;
      switch (sortField) {
        case 'date_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'fileNumber':
          return a.fileNumber.localeCompare(b.fileNumber);
        case 'borrowerName': {
          const nameA = primaryA ? `${primaryA.firstName} ${primaryA.lastName}` : '';
          const nameB = primaryB ? `${primaryB.firstName} ${primaryB.lastName}` : '';
          return nameA.localeCompare(nameB);
        }
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }

  // ─── Assignee filter (client-side) ────────────────────────────────────────

  function filterByAssignee(rows: AppRow[]): AppRow[] {
    if (!assigneeFilter) return rows;
    if (assigneeFilter === '__unassigned__') return rows.filter((r) => !r.assignedToId);
    return rows.filter((r) => r.assignedToId === assigneeFilter);
  }

  const displayRows = data ? filterByAssignee(sortedData(data.data)) : [];

  // ─── Selection ────────────────────────────────────────────────────────────

  const allSelected = displayRows.length > 0 && displayRows.every((r) => selectedIds.has(r.id));
  const someSelected = displayRows.some((r) => selectedIds.has(r.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayRows.map((r) => r.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkAction() {
    toast('Bulk operations coming soon', { icon: 'ℹ️' });
  }

  // ─── Column sort direction helpers ────────────────────────────────────────

  function colDir(col: SortField): SortDir {
    return sortField === col ? 'asc' : null;
  }

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
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
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

          {/* Sort by */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Sort by</label>
            <select
              value={sortField}
              onChange={(e) => { setSortField(e.target.value as SortField); setPage(1); }}
              className="text-sm border border-slate-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Assignee filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 whitespace-nowrap">Assignee</label>
            <select
              value={assigneeFilter}
              onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
              className="text-sm border border-slate-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="__unassigned__">Unassigned</option>
              {underwriters.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
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

        {/* Bulk action bar */}
        {someSelected && (
          <BulkActionBar
            count={selectedIds.size}
            onAssign={handleBulkAction}
            onChangeStatus={handleBulkAction}
            onExport={handleBulkAction}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !displayRows.length ? (
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
                  {/* Bulk select header */}
                  <th className="pl-6 pr-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label="Select all"
                    />
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleColumnSort('fileNumber')}
                  >
                    File # <SortIcon dir={colDir('fileNumber')} />
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleColumnSort('borrowerName')}
                  >
                    Borrower <SortIcon dir={colDir('borrowerName')} />
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none"
                    onClick={() => handleColumnSort('status')}
                  >
                    Status <SortIcon dir={colDir('status')} />
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Assigned To
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    LTV
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell cursor-pointer hover:text-slate-700 select-none"
                    onClick={handleDateSort}
                  >
                    Date{' '}
                    <SortIcon
                      dir={
                        sortField === 'date_desc'
                          ? 'desc'
                          : sortField === 'date_asc'
                          ? 'asc'
                          : null
                      }
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((app) => {
                  const primary = app.borrowers.length
                    ? getPrimaryBorrower(app.borrowers)
                    : null;
                  const latestDecision = app.decisions[app.decisions.length - 1];
                  const assigneeName = app.assignedTo
                    ? `${app.assignedTo.firstName} ${app.assignedTo.lastName}`
                    : null;
                  return (
                    <tr
                      key={app.id}
                      className={cn(
                        'hover:bg-slate-50 transition-colors',
                        selectedIds.has(app.id) && 'bg-blue-50'
                      )}
                    >
                      <td className="pl-6 pr-2 py-4 w-8">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Select file ${app.fileNumber}`}
                        />
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600">
                        {app.fileNumber}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">
                          {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                        </p>
                        {app.borrowers.length > 1 && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            +{app.borrowers.length - 1} co-borrower
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <InlineAssign
                          applicationId={app.id}
                          currentAssigneeId={app.assignedToId}
                          currentAssigneeName={assigneeName}
                          underwriters={underwriters}
                        />
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell text-slate-600">
                        {latestDecision ? formatPercent(latestDecision.ltv) : '—'}
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell text-slate-500">
                        {formatDate(app.createdAt)}
                      </td>
                      <td className="px-4 py-4">
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
