import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminApi } from '../lib/api';
import type { UserRole } from '../types';
import Spinner from '../components/ui/Spinner';
import { cn } from '../lib/utils';

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'ADMIN', label: 'Admin', color: 'bg-[#FEF3C7] text-[#92400E]' },
  { value: 'BROKER', label: 'Broker', color: 'bg-[#D1FAE5] text-[#065F46]' },
  { value: 'UNDERWRITER', label: 'Underwriter', color: 'bg-[#DBEAFE] text-[#1E40AF]' },
  { value: 'VIEWER', label: 'Viewer', color: 'bg-[#F7F6F3] text-[#6B6860]' },
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#D1FAE5] flex items-center justify-center">
          <Shield size={18} className="text-[#1B4332]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#1A1916]">User Management</h1>
          <p className="text-sm text-[#6B6860] mt-0.5">
            {data ? `${data.total} users` : 'Manage user roles and access levels'}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !data?.data.length ? (
          <div className="text-center py-16 text-sm text-[#6B6860]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E6E1]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide">User</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden sm:table-cell">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-[#6B6860] uppercase tracking-wide">Role</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((user) => {
                  const roleInfo = ROLE_OPTIONS.find((r) => r.value === user.role);
                  return (
                    <tr key={user.id} className="border-b border-[#E8E6E1] last:border-0 hover:bg-[#F7F6F3] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#1B4332] text-xs font-semibold flex-shrink-0 select-none">
                            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-[#1A1916]">{user.firstName} {user.lastName}</p>
                            <p className="text-xs text-[#6B6860] sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-[#6B6860]">{user.email}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            roleInfo?.color ?? 'bg-[#F7F6F3] text-[#6B6860]'
                          )}>
                            {roleInfo?.label ?? user.role}
                          </span>
                          <select
                            value={user.role}
                            onChange={(e) => updateRoleMutation.mutate({ id: user.id, role: e.target.value as UserRole })}
                            className="text-xs border border-[#E8E6E1] rounded-lg px-2 py-1 text-[#1A1916] bg-white focus:outline-none focus:border-[#1B4332]"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
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
              <span className="text-xs font-mono text-[#6B6860]">{page} / {totalPages}</span>
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
