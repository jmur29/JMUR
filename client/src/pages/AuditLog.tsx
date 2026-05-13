import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, ClipboardList } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { AuditLog } from '../types';
import { cn } from '../lib/utils';
import { formatDateTime } from '../lib/utils';
import Spinner from '../components/ui/Spinner';
import Breadcrumb from '../components/ui/Breadcrumb';

// ─── Action badge ─────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  APPLICATION_CREATED: 'bg-blue-100 text-blue-700',
  APPLICATION_UPDATED: 'bg-amber-100 text-amber-700',
  APPLICATION_DELETED: 'bg-red-100 text-red-700',
  DECISION_SAVED: 'bg-green-100 text-green-700',
  NOTE_CREATED: 'bg-blue-100 text-blue-700',
  NOTE_DELETED: 'bg-red-100 text-red-700',
  CONDITION_CREATED: 'bg-blue-100 text-blue-700',
  CONDITION_UPDATED: 'bg-amber-100 text-amber-700',
  CONDITION_DELETED: 'bg-red-100 text-red-700',
  USER_ROLE_UPDATED: 'bg-amber-100 text-amber-700',
  DOCUMENT_UPLOADED: 'bg-violet-100 text-violet-700',
  DOCUMENT_DELETED: 'bg-red-100 text-red-700',
};

function actionBadgeClass(action: string): string {
  // Coarse matching for generic categories
  if (action in ACTION_COLORS) return ACTION_COLORS[action];
  if (action.includes('DELETE')) return 'bg-red-100 text-red-700';
  if (action.includes('UPDATE')) return 'bg-amber-100 text-amber-700';
  if (action.includes('CREATE')) return 'bg-blue-100 text-blue-700';
  if (action.includes('DECISION')) return 'bg-green-100 text-green-700';
  if (action.includes('UPLOAD')) return 'bg-violet-100 text-violet-700';
  return 'bg-slate-100 text-slate-600';
}

// ─── Known actions for select ─────────────────────────────────────────────────

const KNOWN_ACTIONS = [
  'APPLICATION_CREATED',
  'APPLICATION_UPDATED',
  'APPLICATION_DELETED',
  'DECISION_SAVED',
  'NOTE_CREATED',
  'NOTE_DELETED',
  'CONDITION_CREATED',
  'CONDITION_UPDATED',
  'CONDITION_DELETED',
  'USER_ROLE_UPDATED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_DELETED',
];

// ─── Metadata tooltip ─────────────────────────────────────────────────────────

function MetadataCell({ metadata }: { metadata: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const str = JSON.stringify(metadata, null, 2);

  if (!str || str === '{}') return <span className="text-slate-400 text-xs">—</span>;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="View details"
      >
        <Info size={14} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-80 max-h-60 overflow-auto bg-slate-900 text-slate-100 rounded-lg p-3 shadow-xl text-xs font-mono whitespace-pre">
            {str}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AuditLogPage ─────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const [applicationId, setApplicationId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit', { applicationId, action, page, pageSize }],
    queryFn: () =>
      adminApi.listAuditLogs({
        applicationId: applicationId || undefined,
        action: action || undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Audit Log' }]}
      />
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500 mt-1">Track all actions performed in the system.</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Application ID</label>
          <input
            type="text"
            value={applicationId}
            onChange={(e) => {
              setApplicationId(e.target.value);
              handleFilterChange();
            }}
            placeholder="Filter by application ID…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              handleFilterChange();
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">All actions</option>
            {KNOWN_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ClipboardList size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium mb-1">No audit events found for these filters</p>
            <p className="text-slate-400 text-sm">
              Try adjusting the application ID or action filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Application
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((log: AuditLog & { user: { firstName: string; lastName: string; email: string } }) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {log.user.firstName} {log.user.lastName}
                          </p>
                          <p className="text-xs text-slate-400">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">{log.userId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                          actionBadgeClass(log.action)
                        )}
                      >
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {log.applicationId ? (
                        <span className="text-blue-600">{log.applicationId.slice(0, 8)}…</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <MetadataCell metadata={log.metadata} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">
              {data.total} total entries · Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
