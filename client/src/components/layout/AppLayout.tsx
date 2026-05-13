import { useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import { cn } from '../../lib/utils';

function useBreadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const crumbs: { label: string; to: string }[] = [];
  let accumulated = '';

  for (const seg of segments) {
    accumulated += `/${seg}`;
    // Humanize
    const label =
      seg === 'dashboard'
        ? 'Dashboard'
        : seg === 'applications'
        ? 'Applications'
        : seg === 'new'
        ? 'New Application'
        : seg === 'admin'
        ? 'Admin'
        : seg === 'pipeline'
        ? 'Pipeline'
        : seg === 'report'
        ? 'Report'
        : seg.length > 10
        ? '...'
        : seg;

    crumbs.push({ label, to: accumulated });
  }

  return crumbs;
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const crumbs = useBreadcrumbs();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 bg-slate-900">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex flex-col w-64 h-full bg-slate-900">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
                aria-label="Close sidebar"
              >
                <X size={20} />
              </button>
            </div>
            <Sidebar onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <nav className="flex-1 flex items-center gap-1 text-sm min-w-0">
            {crumbs.map((crumb, i) => (
              <span key={crumb.to} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                {i === crumbs.length - 1 ? (
                  <span className="font-medium text-slate-900 truncate">{crumb.label}</span>
                ) : (
                  <NavLink
                    to={crumb.to}
                    className="text-slate-500 hover:text-slate-700 truncate transition-colors"
                  >
                    {crumb.label}
                  </NavLink>
                )}
              </span>
            ))}
          </nav>

          {/* Right side: user + sign out */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user && (
              <span className="hidden sm:block text-sm text-slate-600">
                {user.firstName} {user.lastName}
              </span>
            )}
            <button
              onClick={() => signOut({ redirectUrl: '/sign-in' })}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600',
                'hover:bg-slate-100 hover:text-slate-800 transition-colors'
              )}
              title="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
