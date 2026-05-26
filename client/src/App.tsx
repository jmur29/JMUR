import React, { useEffect, useState } from 'react';
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

interface ApiErrorDetail {
  status: number;
  error: string;
  code: string;
  url: string;
}

// Shows API errors (401, 503) as a fixed banner — never auto-redirects or signs out.
// Dismiss to clear. Refresh the page to retry.
function ApiErrorBanner() {
  const [errors, setErrors] = useState<ApiErrorDetail[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ApiErrorDetail>).detail;
      setErrors((prev) => [...prev, detail]);
    };
    window.addEventListener('clearpath:api-error', handler);
    return () => window.removeEventListener('clearpath:api-error', handler);
  }, []);

  if (!errors.length) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: '#7f1d1d', color: '#fef2f2', padding: '12px 16px 10px',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '13px',
      lineHeight: '1.6', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        ⚠ API Error — you are NOT being signed out automatically
      </div>
      {errors.map((e, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <span style={{ opacity: 0.7 }}>[{e.status}]</span>{' '}
          <span style={{ fontWeight: 600 }}>{e.code}</span>:{' '}
          {e.error}{' '}
          <span style={{ opacity: 0.6 }}>— {e.url}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setErrors([])}
          style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', padding: '3px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 12,
          }}
        >
          Dismiss
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', padding: '3px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 12,
          }}
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ApiErrorBanner />
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
