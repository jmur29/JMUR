import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn, SignUp, useAuth, useClerk } from '@clerk/clerk-react';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import ApplicationList from './pages/ApplicationList';
import NewApplication from './pages/NewApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import ApplicationReport from './pages/ApplicationReport';
import Admin from './pages/Admin';
import AdminPipeline from './pages/AdminPipeline';
import DealImport from './pages/DealImport';
import DealIntelligenceReport from './pages/DealIntelligenceReport';
import DealReviewDashboard from './pages/DealReviewDashboard';
import { useApiAuth } from './lib/api';
import Spinner from './components/ui/Spinner';

function AuthSync() {
  useApiAuth();
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
  const { signOut } = useClerk();
  useEffect(() => {
    const handler = () => {
      // Sign out of Clerk first so the redirect to /sign-in doesn't
      // immediately bounce back to /dashboard (the loop-breaker).
      signOut().catch(() => null).finally(() => {
        window.location.href = '/sign-in';
      });
    };
    window.addEventListener('clearpath:unauthorized', handler);
    return () => window.removeEventListener('clearpath:unauthorized', handler);
  }, [signOut]);
  return null;
}

export default function App() {
  return (
    <>
      <UnauthorizedListener />
      <Routes>
        {/* Public auth routes */}
        <Route
          path="/sign-in/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-[#F7F6F3]">
              <SignIn routing="path" path="/sign-in" afterSignInUrl="/dashboard" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-[#F7F6F3]">
              <SignUp routing="path" path="/sign-up" afterSignUpUrl="/dashboard" />
            </div>
          }
        />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <AuthSync />
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
          <Route path="/import" element={<DealImport />} />
          <Route path="/applications/:id/intelligence" element={<DealIntelligenceReport />} />
          <Route path="/applications/:id/review" element={<DealReviewDashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/pipeline" element={<AdminPipeline />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
