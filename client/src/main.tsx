import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AxiosError } from 'axios';
import App from './App';
import './index.css';

// ---------------------------------------------------------------------------
// Config guard — render a visible error instead of throwing so the user
// can see what's missing rather than getting a blank page.
// ---------------------------------------------------------------------------
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const root = document.getElementById('root')!;

if (!PUBLISHABLE_KEY) {
  root.innerHTML = `
    <div style="font-family:ui-monospace,monospace;font-size:13px;padding:32px;color:#111;background:#fff;min-height:100vh">
      <div style="font-weight:700;font-size:16px;color:#7f1d1d;margin-bottom:12px">
        ⚠ Missing VITE_CLERK_PUBLISHABLE_KEY
      </div>
      <p style="margin-bottom:8px">
        The Vercel environment variable <code>VITE_CLERK_PUBLISHABLE_KEY</code>
        is not set in this build.
      </p>
      <p style="color:#6b7280;font-size:12px">
        1. Go to Vercel → your project → Settings → Environment Variables<br>
        2. Add <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> = <em>pk_test_…</em> (from Clerk dashboard)<br>
        3. Redeploy — this variable is baked in at build time
      </p>
    </div>`;
  // Stop execution — do not mount React
} else {

// ---------------------------------------------------------------------------
// React Query — do not retry 401/403/404, only retry network errors
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof AxiosError) {
          const status = error.response?.status;
          if (status === 401 || status === 403 || status === 404 || status === 503) return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});

// ---------------------------------------------------------------------------
// Error boundary — catches render errors instead of showing blank page
// ---------------------------------------------------------------------------
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 13, padding: 32,
          background: '#fff', color: '#111', minHeight: '100vh',
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: '#7f1d1d' }}>
            ⚠ App crashed — uncaught render error
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong>{error.name}:</strong> {error.message}
          </div>
          <pre style={{
            background: '#f1f5f9', padding: 16, borderRadius: 6,
            overflow: 'auto', fontSize: 12, lineHeight: 1.6,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16, padding: '8px 16px', background: '#1B4332',
              color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1e293b',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  borderRadius: '8px',
                },
                success: {
                  iconTheme: { primary: '#22c55e', secondary: '#fff' },
                },
                error: {
                  iconTheme: { primary: '#ef4444', secondary: '#fff' },
                },
              }}
            />
          </BrowserRouter>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ClerkProvider>
    </RootErrorBoundary>
  </React.StrictMode>
);

} // end PUBLISHABLE_KEY guard
