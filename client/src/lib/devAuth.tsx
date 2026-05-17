/**
 * Dev-only auth bypass. Used when VITE_CLERK_PUBLISHABLE_KEY=pk_test_placeholder.
 * Simulates Clerk's auth surface using the server-side test bypass (x-test-user-id header).
 * Never included in production builds (tree-shaken when IS_DEV_AUTH=false).
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

export const IS_DEV_AUTH = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY === 'pk_test_placeholder';

export const SEED_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000002',
    label: 'Admin — admin@democu.ca',
    role: 'ADMIN',
    email: 'admin@democu.ca',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    label: 'Underwriter — uw@democu.ca',
    role: 'UNDERWRITER',
    email: 'uw@democu.ca',
  },
] as const;

interface DevAuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
}

interface DevAuthCtxValue extends DevAuthState {
  signIn: (userId: string) => void;
  signOut: () => void;
}

const DevAuthCtx = createContext<DevAuthCtxValue>({
  isLoaded: false,
  isSignedIn: false,
  userId: null,
  signIn: () => {},
  signOut: () => {},
});

export function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DevAuthState>({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
  });

  useEffect(() => {
    const stored = localStorage.getItem('dev_user_id');
    setState({ isLoaded: true, isSignedIn: !!stored, userId: stored });
  }, []);

  function signIn(userId: string) {
    localStorage.setItem('dev_user_id', userId);
    setState({ isLoaded: true, isSignedIn: true, userId });
  }

  function signOut() {
    localStorage.removeItem('dev_user_id');
    setState({ isLoaded: true, isSignedIn: false, userId: null });
  }

  return (
    <DevAuthCtx.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </DevAuthCtx.Provider>
  );
}

export function useDevAuth() {
  return useContext(DevAuthCtx);
}

export function DevLoginPage() {
  const { signIn } = useDevAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">ClearPath UW</h1>
          <p className="text-sm text-slate-500 mt-1">Dev bypass — select a test user</p>
        </div>

        <div className="space-y-3">
          {SEED_USERS.map((u) => (
            <button
              key={u.id}
              onClick={() => signIn(u.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-700 font-semibold text-sm">
                  {u.email[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{u.role}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Test auth bypass active — server NODE_ENV=test
        </p>
      </div>
    </div>
  );
}
