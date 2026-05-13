import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi } from '../lib/api';
import type { UserRole } from '../types';

// ---------------------------------------------------------------------------
// useUsers — list all users (paginated)
// ---------------------------------------------------------------------------
export function useUsers(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['admin', 'users', { page, pageSize }],
    queryFn: () => adminApi.listUsers({ page, pageSize }),
  });
}

// ---------------------------------------------------------------------------
// useUpdateUserRole
// ---------------------------------------------------------------------------
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });
}
