import { cn } from '../../lib/utils';

interface GDSTDSIndicatorProps {
  gds: number;
  tds: number;
  compact?: boolean;
}

// OSFI limits: GDS ≤ 39%, TDS ≤ 44%
function getColor(value: number, limit: number): string {
  if (value > limit) return 'bg-red-100 text-red-700';
  if (value >= limit - 3) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

export default function GDSTDSIndicator({ gds, tds, compact = false }: GDSTDSIndicatorProps) {
  const gdsColor = getColor(gds, 39);
  const tdsColor = getColor(tds, 44);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium', gdsColor)}>
          {gds.toFixed(1)}%
        </span>
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium', tdsColor)}>
          {tds.toFixed(1)}%
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', gdsColor)}>
        <span className="font-normal">GDS</span>
        {gds.toFixed(1)}%
      </span>
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', tdsColor)}>
        <span className="font-normal">TDS</span>
        {tds.toFixed(1)}%
      </span>
    </span>
  );
}
