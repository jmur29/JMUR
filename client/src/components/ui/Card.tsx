import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-[#E8E6E1]', padding && 'p-6', className)}>
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
        <h3 className="text-base font-semibold text-[#1A1916]">{title}</h3>
        {subtitle && <p className="text-sm text-[#6B6860] mt-0.5">{subtitle}</p>}
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
    <div className={cn('bg-white rounded-xl border border-[#E8E6E1] p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#6B6860] uppercase tracking-wide truncate">{label}</p>
          <p className="text-2xl font-mono font-bold text-[#1B4332] mt-1">{value}</p>
          {subtext && <p className="text-xs text-[#6B6860] mt-1">{subtext}</p>}
          {trend !== undefined && (
            <p className={cn('text-xs font-medium mt-1', trend.value >= 0 ? 'text-[#1B4332]' : 'text-[#991B1B]')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[#D1FAE5] flex items-center justify-center ml-4 flex-shrink-0 text-[#1B4332]">{icon}</div>
        )}
      </div>
    </div>
  );
}
