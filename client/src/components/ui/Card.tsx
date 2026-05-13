import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-sm border border-slate-200',
        padding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ label, value, subtext, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-lg shadow-sm border border-slate-200 p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
          {trend !== undefined && (
            <p
              className={cn(
                'text-xs font-medium mt-1',
                trend.value >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-blue-50 rounded-lg ml-4 flex-shrink-0 text-blue-600">{icon}</div>
        )}
      </div>
    </div>
  );
}
