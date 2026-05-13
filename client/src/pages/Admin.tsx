import { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useUsers, useUpdateUserRole } from '../hooks/useUsers';
import type { UserRole } from '../types';
import Spinner from '../components/ui/Spinner';
import Breadcrumb from '../components/ui/Breadcrumb';
import Pagination from '../components/ui/Pagination';
import { cn } from '../lib/utils';

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'ADMIN', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'UNDERWRITER', label: 'Underwriter', color: 'bg-blue-100 text-blue-700' },
  { value: 'VIEWER', label: 'Viewer', color: 'bg-slate-100 text-slate-600' },
];

const PAGE_SIZE = 20;

export default function Admin() {
  const [page, setPage] = useState(1);
  const { user: currentClerkUser } = useUser();

  const { data, isLoading } = useUsers(page, PAGE_SIZE);
  const updateRoleMutation = useUpdateUserRole();

  // Track which userId is currently being updated so we show a per-row spinner
  const savingUserId = updateRoleMutation.isPending
    ? (updateRoleMutation.variables as { userId: string; role: UserRole } | undefined)?.userId
    : undefined;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
      />

      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-50 rounded-lg">
          <Shield size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total} user${data.total === 1 ? '' : 's'}` : 'Manage user roles and access levels'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data?.data.length ? (
          <div className="flex flex-col items-center py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Users size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-medium mb-1">No team members yet</p>
            <p className="text-slate-400 text-sm">
              Users will appear here once they log in for the first time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                    Email
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((user) => {
                  const roleInfo = ROLE_OPTIONS.find((r) => r.value === user.role);
                  const isSelf = user.clerkId === currentClerkUser?.id;
                  const isSaving = savingUserId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-medium flex-shrink-0">
                            {user.firstName.charAt(0)}
                            {user.lastName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {user.firstName} {user.lastName}
                              {isSelf && (
                                <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                              )}
                            </p>
                            <p className="text-xs text-slate-400 sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                              roleInfo?.color ?? 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {roleInfo?.label ?? user.role}
                          </span>
                          {isSaving ? (
                            <Spinner size="sm" />
                          ) : (
                            <select
                              value={user.role}
                              disabled={isSelf}
                              onChange={(e) =>
                                updateRoleMutation.mutate({
                                  userId: user.id,
                                  role: e.target.value as UserRole,
                                })
                              }
                              className={cn(
                                'text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400',
                                isSelf && 'opacity-40 cursor-not-allowed'
                              )}
                              title={isSelf ? "You can't change your own role" : undefined}
                            >
                              {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
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
