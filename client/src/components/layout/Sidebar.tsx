import React, { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  FileText,
  Shield,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Plus,
  Users,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ collapsed = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useUser();
  const [adminOpen, setAdminOpen] = useState(
    location.pathname.startsWith('/admin')
  );

  const role = (user?.publicMetadata?.role as string) ?? 'VIEWER';
  const isAdmin = role === 'ADMIN';

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??';

  return (
    <nav className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[#E8E6E1] flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#1B4332] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none">
          CP
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[#1A1916] font-semibold text-base tracking-tight leading-tight">
              ClearPath UW
            </span>
            {role && (
              <span className="text-[10px] font-medium text-[#6B6860] uppercase tracking-wide leading-tight mt-0.5">
                {role}
              </span>
            )}
          </div>
        )}
      </div>

      {/* New Submission CTA */}
      {!collapsed && (
        <div className="px-3 pt-4 pb-1">
          <Link
            to="/applications/new"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg bg-white border border-[#1B4332] text-[#1B4332] text-sm font-medium hover:bg-[#D1FAE5] transition-colors"
          >
            <Plus size={14} />
            New Submission
          </Link>
        </div>
      )}

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 scrollbar-thin">
        {/* Dashboard */}
        <NavLink
          to="/dashboard"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded-r-md',
              isActive
                ? 'nav-link-active'
                : 'nav-link-inactive'
            )
          }
        >
          <LayoutDashboard size={18} className="flex-shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>

        {/* Files */}
        <NavLink
          to="/applications"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded-r-md',
              isActive
                ? 'nav-link-active'
                : 'nav-link-inactive'
            )
          }
        >
          <FileText size={18} className="flex-shrink-0" />
          {!collapsed && <span>Files</span>}
        </NavLink>

        {/* Admin (expandable, admin only) */}
        {isAdmin && (
          <div>
            <button
              onClick={() => setAdminOpen((o) => !o)}
              className={cn(
                'flex items-center w-full gap-3 px-3 py-2.5 text-sm font-medium transition-colors rounded-r-md',
                location.pathname.startsWith('/admin')
                  ? 'nav-link-active'
                  : 'nav-link-inactive'
              )}
            >
              <Shield size={18} className="flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Admin</span>
                  {adminOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </>
              )}
            </button>

            {adminOpen && !collapsed && (
              <div className="mt-0.5 ml-7 space-y-0.5">
                <NavLink
                  to="/admin"
                  end
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-r-md',
                      isActive
                        ? 'nav-link-active'
                        : 'nav-link-inactive'
                    )
                  }
                >
                  <Users size={15} className="flex-shrink-0" />
                  Users
                </NavLink>
                <NavLink
                  to="/admin/pipeline"
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-r-md',
                      isActive
                        ? 'nav-link-active'
                        : 'nav-link-inactive'
                    )
                  }
                >
                  <BarChart2 size={15} className="flex-shrink-0" />
                  Pipeline
                </NavLink>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User info */}
      {!collapsed && user && (
        <div className="flex-shrink-0 px-4 py-4 border-t border-[#E8E6E1]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#D1FAE5] flex items-center justify-center text-[#1B4332] text-xs font-semibold flex-shrink-0 select-none">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1916] truncate">
                {firstName} {lastName}
              </p>
              <p className="text-xs text-[#6B6860] truncate">
                {role}
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
