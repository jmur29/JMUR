import { useUser } from '@clerk/clerk-react';
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

export function usePermissions() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as UserRole) ?? 'VIEWER';

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
