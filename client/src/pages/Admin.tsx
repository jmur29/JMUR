import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { UserRole } from '../types';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { cn } from '../lib/utils';

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'ADMIN', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'UNDERWRITER', label: 'Underwriter', color: 'bg-blue-100 text-blue-700' },
  { value: 'VIEWER', label: 'Viewer', color: 'bg-slate-100 text-slate-600' },
];

const PAGE_SIZE = 20;

export default function Admin() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page],
    queryFn: () => adminApi.listUsers({ page, pageSize: PAGE_SIZE }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      adminApi.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-50 rounded-lg">
          <Shield size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total} users` : 'Manage user roles and access levels'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-16 text-slate-400 text-sm">No users found.</div>
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
                          <select
                            value={user.role}
                            onChange={(e) =>
                              updateRoleMutation.mutate({
                                id: user.id,
                                role: e.target.value as UserRole,
                              })
                            }
                            className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
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
