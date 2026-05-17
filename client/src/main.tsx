import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { IS_DEV_AUTH, DevAuthProvider } from './lib/devAuth';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const toaster = (
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
      success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
      error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
    }}
  />
);

const inner = (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
      {toaster}
    </BrowserRouter>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);

if (IS_DEV_AUTH) {
  // Dev bypass: no Clerk, use x-test-user-id header auth
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <DevAuthProvider>{inner}</DevAuthProvider>
    </React.StrictMode>
  );
} else {
  // Production: require a real Clerk publishable key
  if (!PUBLISHABLE_KEY) {
    throw new Error('Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY in .env');
  }
  // Lazy-import ClerkProvider so it's only bundled when needed
  import('@clerk/clerk-react').then(({ ClerkProvider }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          {inner}
        </ClerkProvider>
      </React.StrictMode>
    );
  });
}
