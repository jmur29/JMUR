import React from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('border-b border-slate-200', className)}>
      <nav className="-mb-px flex space-x-1 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
              aria-selected={isActive}
              role="tab"
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium min-w-[18px]',
                    isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
