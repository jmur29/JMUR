import { useUser } from '@clerk/clerk-react';

type Role = 'ADMIN' | 'UNDERWRITER' | 'VIEWER';
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

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'create:application', 'edit:application', 'delete:application',
    'run:calculation', 'issue:decision', 'manage:documents',
    'manage:users', 'view:admin', 'manage:tenant', 'view:audit',
  ],
  UNDERWRITER: [
    'create:application', 'edit:application', 'run:calculation',
    'issue:decision', 'manage:documents',
  ],
  VIEWER: ['manage:documents'],
};

export function usePermissions() {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as Role) ?? 'VIEWER';

  return {
    role,
    can: (permission: Permission): boolean =>
      ROLE_PERMISSIONS[role]?.includes(permission) ?? false,
    isAdmin: role === 'ADMIN',
    isUnderwriter: role === 'UNDERWRITER' || role === 'ADMIN',
    isViewer: role === 'VIEWER',
  };
}
