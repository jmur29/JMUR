import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { IS_DEV_AUTH, useDevAuth } from '../lib/devAuth';
import type { UserRole } from '../types';

type Permission =
  | 'create:application'
  | 'edit:application'
  | 'delete:application'
  | 'run:calculation'
  | 'issue:decision'
  | 'manage:documents'
  | 'manage:users'
  | 'view:admin'
  | 'manage:tenant'
  | 'view:audit';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    'create:application', 'edit:application', 'delete:application',
    'run:calculation', 'issue:decision', 'manage:documents',
    'manage:users', 'view:admin', 'manage:tenant', 'view:audit',
  ],
  UNDERWRITER: [
    'create:application', 'edit:application', 'run:calculation',
    'issue:decision', 'manage:documents',
  ],
  BROKER: [
    'create:application', 'edit:application', 'manage:documents',
  ],
  VIEWER: ['manage:documents'],
};

function buildPermissions(role: UserRole) {
  return {
    role,
    can: (permission: Permission): boolean =>
      ROLE_PERMISSIONS[role]?.includes(permission) ?? false,
    isAdmin: role === 'ADMIN',
    isUnderwriter: role === 'UNDERWRITER' || role === 'ADMIN',
    isBroker: role === 'BROKER',
    isViewer: role === 'VIEWER',
  };
}

// Dev bypass: fetch role from /api/admin/me (uses x-test-user-id header)
function useDevPermissions() {
  const { isSignedIn } = useDevAuth();
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      apiClient.get<{ role: UserRole }>('/admin/me').then((r) => r.data),
    enabled: isSignedIn,
    staleTime: Infinity,
  });
  return buildPermissions(data?.role ?? 'VIEWER');
}

// Production: read role from Clerk publicMetadata (requires ClerkProvider in tree)
function useClerkPermissions() {
  const { user } = useUser();
  const role: UserRole = (user?.publicMetadata?.role as UserRole) ?? 'VIEWER';
  return buildPermissions(role);
}

// IS_DEV_AUTH is a compile-time constant — this assignment never changes at runtime,
// so both branches always call the same hook, satisfying React's rules of hooks.
export const usePermissions = IS_DEV_AUTH ? useDevPermissions : useClerkPermissions;
