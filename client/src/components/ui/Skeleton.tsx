// Skeleton loading placeholder shapes

import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

// Single skeleton bar
export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn('skeleton', className)}
      style={{ width, height }}
    />
  );
}

// Full table loading state: n rows x m cols
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4 rounded"
              style={{ flex: j === 0 ? '0 0 120px' : '1' } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Card loading state
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
      <Skeleton className="h-5 w-1/3 rounded" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3 rounded', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

// Stat card skeleton
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <Skeleton className="h-3 w-20 rounded mb-2" />
      <Skeleton className="h-7 w-24 rounded mb-1" />
      <Skeleton className="h-3 w-16 rounded" />
    </div>
  );
}
