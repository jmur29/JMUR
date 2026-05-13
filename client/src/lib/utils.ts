import { clsx, type ClassValue } from 'clsx';
import { format, parseISO } from 'date-fns';
import type { ApplicationStatus, FlagType, UWDecision } from '../types';

// ---------------------------------------------------------------------------
// cn — clsx wrapper
// ---------------------------------------------------------------------------
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Percentage
// ---------------------------------------------------------------------------
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------
export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a');
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Application status
// ---------------------------------------------------------------------------
export function getStatusColor(status: ApplicationStatus): string {
  const map: Record<ApplicationStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    IN_REVIEW: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
    DECLINED: 'bg-red-100 text-red-700',
    CONDITIONALLY_APPROVED: 'bg-amber-100 text-amber-700',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700';
}

export function getStatusLabel(status: ApplicationStatus): string {
  const map: Record<ApplicationStatus, string> = {
    DRAFT: 'Draft',
    IN_REVIEW: 'In Review',
    APPROVED: 'Approved',
    DECLINED: 'Declined',
    CONDITIONALLY_APPROVED: 'Conditional',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Flag type
// ---------------------------------------------------------------------------
export function getFlagColor(type: FlagType): string {
  const map: Record<FlagType, string> = {
    PASS: 'bg-green-50 text-green-700 border-green-200',
    WARN: 'bg-amber-50 text-amber-700 border-amber-200',
    FAIL: 'bg-red-50 text-red-700 border-red-200',
    INFO: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return map[type] ?? 'bg-slate-50 text-slate-700 border-slate-200';
}

export function getFlagIconColor(type: FlagType): string {
  const map: Record<FlagType, string> = {
    PASS: 'text-green-500',
    WARN: 'text-amber-500',
    FAIL: 'text-red-500',
    INFO: 'text-blue-500',
  };
  return map[type] ?? 'text-slate-500';
}

// ---------------------------------------------------------------------------
// UW Decision
// ---------------------------------------------------------------------------
export function getDecisionColor(decision: UWDecision): string {
  const map: Record<UWDecision, string> = {
    APPROVE: 'bg-green-100 text-green-800',
    MANUAL_REVIEW: 'bg-amber-100 text-amber-800',
    DECLINE: 'bg-red-100 text-red-800',
  };
  return map[decision] ?? 'bg-slate-100 text-slate-800';
}

export function getDecisionLabel(decision: UWDecision): string {
  const map: Record<UWDecision, string> = {
    APPROVE: 'Approve',
    MANUAL_REVIEW: 'Manual Review',
    DECLINE: 'Decline',
  };
  return map[decision] ?? decision;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getPrimaryBorrower(
  borrowers: { type: string; firstName: string; lastName: string }[]
) {
  return borrowers.find((b) => b.type === 'PRIMARY') ?? borrowers[0];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// File download
// ---------------------------------------------------------------------------
export function downloadFile(
  data: string | Blob,
  filename: string,
  mimeType = 'text/csv'
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
