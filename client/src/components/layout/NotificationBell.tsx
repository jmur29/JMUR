import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Upload,
  X,
} from 'lucide-react';
import { applicationsApi } from '../../lib/api';
import type { Application, ApplicationStatus } from '../../types';
import { cn } from '../../lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType = 'APPROVE' | 'DECLINE' | 'MANUAL_REVIEW' | 'ASSIGNMENT' | 'DOCUMENT';

interface Notification {
  id: string;
  applicationId: string;
  fileNumber: string;
  title: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'clearpath:seen_app_ids';

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota errors
  }
}

function deriveNotifType(status: ApplicationStatus): NotificationType {
  if (status === 'APPROVED') return 'APPROVE';
  if (status === 'DECLINED') return 'DECLINE';
  if (status === 'IN_REVIEW') return 'MANUAL_REVIEW';
  return 'ASSIGNMENT';
}

function statusToTitle(fileNumber: string, status: ApplicationStatus): string {
  switch (status) {
    case 'APPROVED': return `File ${fileNumber} approved`;
    case 'DECLINED': return `File ${fileNumber} declined`;
    case 'IN_REVIEW': return `File ${fileNumber} moved to review`;
    case 'CONDITIONALLY_APPROVED': return `File ${fileNumber} conditionally approved`;
    default: return `File ${fileNumber} updated`;
  }
}

function appsToNotifications(
  apps: Application[],
  seenIds: Set<string>
): Notification[] {
  return apps.map((app) => ({
    id: `app-${app.id}`,
    applicationId: app.id,
    fileNumber: app.fileNumber,
    title: statusToTitle(app.fileNumber, app.status),
    type: deriveNotifType(app.status),
    createdAt: app.updatedAt,
    read: seenIds.has(app.id),
  }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NotifIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case 'APPROVE':
      return <CheckCircle size={16} className="text-green-500 flex-shrink-0" />;
    case 'DECLINE':
      return <XCircle size={16} className="text-red-500 flex-shrink-0" />;
    case 'MANUAL_REVIEW':
      return <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />;
    case 'DOCUMENT':
      return <Upload size={16} className="text-blue-500 flex-shrink-0" />;
    default:
      return <FileText size={16} className="text-blue-500 flex-shrink-0" />;
  }
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAndMerge = useCallback(async () => {
    try {
      const result = await applicationsApi.list({
        assignedToMe: true,
        page: 1,
        pageSize: 5,
      });
      const seenIds = getSeenIds();
      const next = appsToNotifications(result.data, seenIds);
      setNotifications(next);
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  // Initial fetch + polling every 60s
  useEffect(() => {
    fetchAndMerge();
    pollRef.current = setInterval(fetchAndMerge, 60_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAndMerge]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    const seenIds = getSeenIds();
    notifications.forEach((n) => seenIds.add(n.applicationId));
    saveSeenIds(seenIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleItemClick = (notif: Notification) => {
    // Mark this one as read
    const seenIds = getSeenIds();
    seenIds.add(notif.applicationId);
    saveSeenIds(seenIds);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setOpen(false);
    navigate(`/applications/${notif.applicationId}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors',
          open && 'bg-slate-100 text-slate-700'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Bell size={24} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                    !notif.read && 'bg-blue-50/40'
                  )}
                >
                  {/* Unread dot */}
                  <span
                    className={cn(
                      'mt-1.5 w-2 h-2 rounded-full flex-shrink-0',
                      notif.read ? 'bg-transparent' : 'bg-blue-500'
                    )}
                  />
                  <NotifIcon type={notif.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium leading-snug">
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(notif.createdAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
