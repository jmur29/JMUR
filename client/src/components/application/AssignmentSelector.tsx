import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, applicationsApi } from '../../lib/api';
import type { User } from '../../types';
import { cn } from '../../lib/utils';

// ─── Avatar helpers ────────────────────────────────────────────────────────────

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-orange-500',
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

function userInitials(user: User): string {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
}

function userFullName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AssignmentSelectorProps {
  applicationId: string;
  assignedTo: User | null;
  currentRole: string;
}

export default function AssignmentSelector({
  applicationId,
  assignedTo,
  currentRole,
}: AssignmentSelectorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isViewer = currentRole === 'VIEWER';

  // Fetch team members (ADMIN + UNDERWRITER)
  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.listUsers({ pageSize: 200 }),
    enabled: !isViewer && open,
    staleTime: 60_000,
  });

  const teamMembers = (usersData?.data ?? []).filter(
    (u) => u.role === 'ADMIN' || u.role === 'UNDERWRITER'
  );

  const assignMutation = useMutation({
    mutationFn: (userId: string | null) =>
      applicationsApi.update(applicationId, { assignedToId: userId }),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['application', applicationId] });
      setOpen(false);
      if (userId === null) {
        toast.success('Assignment cleared');
      } else {
        const user = teamMembers.find((u) => u.id === userId);
        toast.success(user ? `Assigned to ${userFullName(user)}` : 'Assignment updated');
      }
    },
    onError: () => toast.error('Failed to update assignment'),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const displayName = assignedTo ? userFullName(assignedTo) : 'Unassigned';
  const color = assignedTo ? avatarColor(userFullName(assignedTo)) : 'bg-slate-300';

  // VIEWER: read-only label
  if (isViewer) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <UserCheck size={14} className="text-slate-400 flex-shrink-0" />
        <span>{displayName}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        disabled={assignMutation.isPending}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors',
          'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300',
          'text-slate-700 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {assignedTo ? (
          <span
            className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0',
              color
            )}
          >
            {userInitials(assignedTo)}
          </span>
        ) : (
          <UserCheck size={14} className="text-slate-400 flex-shrink-0" />
        )}
        <span className="max-w-[120px] truncate">{displayName}</span>
        <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[200px] max-h-64 overflow-y-auto">
          {/* Unassign option */}
          <button
            onClick={() => assignMutation.mutate(null)}
            disabled={assignMutation.isPending}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors',
              !assignedTo && 'bg-slate-50 font-medium'
            )}
          >
            <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
              <UserCheck size={13} className="text-slate-500" />
            </span>
            <span className="text-slate-500">Unassigned</span>
          </button>

          {teamMembers.length > 0 && (
            <div className="border-t border-slate-100 mt-1 pt-1">
              {teamMembers.map((user) => {
                const name = userFullName(user);
                const isSelected = assignedTo?.id === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => assignMutation.mutate(user.id)}
                    disabled={assignMutation.isPending}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    <span
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0',
                        avatarColor(name)
                      )}
                    >
                      {userInitials(user)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-medium truncate', isSelected ? 'text-blue-700' : 'text-slate-900')}>
                        {name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user.role}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {teamMembers.length === 0 && (
            <p className="px-3 py-3 text-xs text-slate-400 text-center">Loading team…</p>
          )}
        </div>
      )}
    </div>
  );
}
