/**
 * Unified "current user" hook that works in both dev bypass and production Clerk mode.
 * Returns { firstName, lastName, email, signOut }.
 */
import { useUser, useClerk } from '@clerk/clerk-react';
import { IS_DEV_AUTH, useDevAuth, SEED_USERS } from '../lib/devAuth';

interface CurrentUser {
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
}

interface UseCurrentUserResult {
  user: CurrentUser | null;
  signOut: () => void;
}

function useDevCurrentUser(): UseCurrentUserResult {
  const { userId, signOut } = useDevAuth();
  const seedUser = SEED_USERS.find((u) => u.id === userId) ?? null;
  return {
    user: seedUser
      ? {
          firstName: seedUser.role === 'ADMIN' ? 'Demo' : 'Demo',
          lastName: seedUser.role === 'ADMIN' ? 'Admin' : 'Underwriter',
          email: seedUser.email,
        }
      : null,
    signOut,
  };
}

function useClerkCurrentUser(): UseCurrentUserResult {
  const { user } = useUser();
  const { signOut } = useClerk();
  return {
    user: user
      ? {
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          email: user.primaryEmailAddress?.emailAddress ?? '',
          imageUrl: user.imageUrl,
        }
      : null,
    signOut: () => signOut({ redirectUrl: '/sign-in' }),
  };
}

export const useCurrentUser = IS_DEV_AUTH ? useDevCurrentUser : useClerkCurrentUser;
