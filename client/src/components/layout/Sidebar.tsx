import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  FileText,
  Shield,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: <LayoutDashboard size={18} />,
  },
  {
    label: 'Applications',
    to: '/applications',
    icon: <FileText size={18} />,
  },
  {
    label: 'Admin',
    to: '/admin',
    icon: <Shield size={18} />,
    adminOnly: true,
    children: [
      {
        label: 'Users',
        to: '/admin',
        icon: <Shield size={16} />,
        adminOnly: true,
      },
      {
        label: 'Pipeline',
        to: '/admin/pipeline',
        icon: <BarChart2 size={16} />,
        adminOnly: true,
      },
      {
        label: 'Audit Log',
        to: '/admin/audit',
        icon: <ClipboardList size={16} />,
        adminOnly: true,
      },
      {
        label: 'Settings',
        to: '/admin/settings',
        icon: <Settings size={16} />,
        adminOnly: true,
      },
    ],
  },
];

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

  // Read role from Clerk publicMetadata
  const role = (user?.publicMetadata?.role as string) ?? 'VIEWER';
  const isAdmin = role === 'ADMIN';

  return (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          CP
        </div>
        {!collapsed && (
          <span className="text-white font-semibold text-base tracking-tight">
            ClearPath UW
          </span>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;

          if (item.children) {
            const isParentActive = location.pathname.startsWith(item.to);
            return (
              <div key={item.to}>
                <button
                  onClick={() => setAdminOpen((o) => !o)}
                  className={cn(
                    'flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isParentActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {adminOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </>
                  )}
                </button>
                {adminOpen && !collapsed && (
                  <div className="mt-1 ml-4 space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === '/admin'}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-blue-600/80 text-white'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          )
                        }
                      >
                        <span className="flex-shrink-0">{child.icon}</span>
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {/* User info */}
      {!collapsed && user && (
        <div className="flex-shrink-0 px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-medium flex-shrink-0">
              {user.firstName?.charAt(0)}
              {user.lastName?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {(user.publicMetadata?.role as string) ?? 'VIEWER'}
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
