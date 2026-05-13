import { cn } from '../../lib/utils';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  className?: string;
}

function buildPageWindow(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];

  // Always show first 2
  pages.push(1, 2);

  const windowStart = Math.max(3, page - 1);
  const windowEnd = Math.min(totalPages - 2, page + 1);

  if (windowStart > 3) {
    pages.push('...');
  }

  for (let i = windowStart; i <= windowEnd; i++) {
    pages.push(i);
  }

  if (windowEnd < totalPages - 2) {
    pages.push('...');
  }

  // Always show last 2
  pages.push(totalPages - 1, totalPages);

  // Deduplicate (can happen when page is near start/end)
  const seen = new Set<number | '...'>();
  return pages.filter((p) => {
    if (p === '...') return true;
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1 && total <= pageSize) return null;

  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);
  const pageWindow = buildPageWindow(page, totalPages);

  const btnBase =
    'inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';

  return (
    <div className={cn('flex items-center justify-between gap-4 flex-wrap', className)}>
      {/* Label — hidden on mobile */}
      <p className="hidden sm:block text-sm text-slate-500 shrink-0">
        Showing {start}–{end} of {total} results
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onChange(1)}
          disabled={page <= 1}
          className={cn(
            btnBase,
            'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-label="First page"
        >
          «
        </button>

        {/* Prev */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            btnBase,
            'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* Page numbers */}
        {pageWindow.map((p, idx) =>
          p === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex items-center justify-center min-w-[2rem] h-8 px-1 text-sm text-slate-400 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(
                btnBase,
                'border',
                p === page
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            btnBase,
            'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-label="Next page"
        >
          ›
        </button>

        {/* Last */}
        <button
          onClick={() => onChange(totalPages)}
          disabled={page >= totalPages}
          className={cn(
            btnBase,
            'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
          )}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
