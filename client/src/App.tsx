import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';
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
import { useApiAuth } from './lib/api';
import Spinner from './components/ui/Spinner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from './components/ui/KeyboardShortcutsModal';

function AuthSync() {
  useApiAuth();
  useKeyboardShortcuts();
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

function UnauthorizedListener() {
  useEffect(() => {
    const handler = () => {
      window.location.href = '/sign-in';
    };
    window.addEventListener('clearpath:unauthorized', handler);
    return () => window.removeEventListener('clearpath:unauthorized', handler);
  }, []);
  return null;
}

export default function App() {
  return (
    <>
      <UnauthorizedListener />
      <ErrorBoundary>
      <Routes>
        {/* Public auth routes */}
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

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <AuthSync />
              <KeyboardShortcutsModal />
              <AppLayout />
            </ProtectedRoute>
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

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </ErrorBoundary>
    </>
  );
}
