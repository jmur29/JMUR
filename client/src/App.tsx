import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import ApplicationList from './pages/ApplicationList';
import NewApplication from './pages/NewApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import ApplicationReport from './pages/ApplicationReport';
import Admin from './pages/Admin';
import AdminPipeline from './pages/AdminPipeline';
import AuditLog from './pages/AuditLog';
import TenantSettings from './pages/TenantSettings';
import { setTestUserId, useApiAuth } from './lib/api';
import Spinner from './components/ui/Spinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from './components/ui/KeyboardShortcutsModal';
import { IS_DEV_AUTH, useDevAuth, DevLoginPage } from './lib/devAuth';

// ─── Dev bypass app (no Clerk) ────────────────────────────────────────────────

function DevAuthSync() {
  const { userId } = useDevAuth();
  useKeyboardShortcuts();
  useEffect(() => {
    setTestUserId(userId);
  }, [userId]);
  return null;
}

function DevApp() {
  const { isLoaded, isSignedIn } = useDevAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isSignedIn) return <DevLoginPage />;

  return (
    <>
      <DevAuthSync />
      <KeyboardShortcutsModal />
      <AppLayout />
    </>
  );
}

// ─── Production app (Clerk) ───────────────────────────────────────────────────

function ClerkApp() {
  // Dynamic import so this file doesn't crash when Clerk isn't in the tree.
  // These components are only rendered when ClerkProvider is present.
  const [ClerkComponents, setClerkComponents] = React.useState<{
    SignIn: React.ComponentType<Record<string, unknown>>;
    SignUp: React.ComponentType<Record<string, unknown>>;
    useAuth: () => { isLoaded: boolean; isSignedIn: boolean | undefined; getToken: () => Promise<string | null> };
  } | null>(null);

  useEffect(() => {
    import('@clerk/clerk-react').then((m) => {
      setClerkComponents({
        SignIn: m.SignIn as React.ComponentType<Record<string, unknown>>,
        SignUp: m.SignUp as React.ComponentType<Record<string, unknown>>,
        useAuth: m.useAuth as () => { isLoaded: boolean; isSignedIn: boolean | undefined; getToken: () => Promise<string | null> },
      });
    });
  }, []);

  if (!ClerkComponents) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return <ClerkAppInner ClerkComponents={ClerkComponents} />;
}

function ClerkAuthSync({ getToken }: { getToken: () => Promise<string | null> }) {
  useApiAuth(getToken);
  useKeyboardShortcuts();
  return null;
}

// Inner component lives inside ClerkProvider — safe to call useAuth() directly
function ClerkAppInner({
  ClerkComponents,
}: {
  ClerkComponents: {
    SignIn: React.ComponentType<Record<string, unknown>>;
    SignUp: React.ComponentType<Record<string, unknown>>;
    useAuth: () => { isLoaded: boolean; isSignedIn: boolean | undefined; getToken: () => Promise<string | null> };
  };
}) {
  const { SignIn, SignUp, useAuth } = ClerkComponents;
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    const handler = () => { window.location.href = '/sign-in'; };
    window.addEventListener('clearpath:unauthorized', handler);
    return () => window.removeEventListener('clearpath:unauthorized', handler);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <SignIn routing="path" path="/sign-in" afterSignInUrl="/dashboard" />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <SignUp routing="path" path="/sign-up" afterSignUpUrl="/dashboard" />
          </div>
        }
      />
      {isSignedIn && (
        <Route
          element={
            <>
              <ClerkAuthSync getToken={getToken} />
              <KeyboardShortcutsModal />
              <AppLayout />
            </>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/applications" element={<ApplicationList />} />
          <Route path="/applications/new" element={<NewApplication />} />
          <Route path="/applications/:id" element={<ApplicationDetail />} />
          <Route path="/applications/:id/report" element={<ApplicationReport />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/pipeline" element={<AdminPipeline />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/settings" element={<TenantSettings />} />
        </Route>
      )}
      <Route path="*" element={<Navigate to={isSignedIn ? '/dashboard' : '/sign-in'} replace />} />
    </Routes>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  if (IS_DEV_AUTH) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="*" element={<DevApp />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ClerkApp />
    </ErrorBoundary>
  );
}
