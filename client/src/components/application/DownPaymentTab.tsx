import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Copy, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../../lib/api';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import type { DownPaymentCategory } from '../../types';
import Spinner from '../ui/Spinner';

interface DownPaymentTabProps {
  applicationId: string;
}

const CATEGORY_CONFIG: Record<DownPaymentCategory, { label: string; className: string }> = {
  PAYROLL: { label: 'Payroll', className: 'bg-green-100 text-green-700' },
  ETRANSFER: { label: 'e-Transfer', className: 'bg-blue-100 text-blue-700' },
  WIRE: { label: 'Wire', className: 'bg-blue-100 text-blue-700' },
  CASH: { label: 'Cash', className: 'bg-red-100 text-red-700' },
  INVESTMENT: { label: 'Investment', className: 'bg-purple-100 text-purple-700' },
  GIFT: { label: 'Gift', className: 'bg-orange-100 text-orange-700' },
  GOVERNMENT: { label: 'Government', className: 'bg-green-100 text-green-700' },
  UNKNOWN: { label: 'Unknown', className: 'bg-slate-100 text-slate-600' },
};

export default function DownPaymentTab({ applicationId }: DownPaymentTabProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['down-payment', applicationId],
    queryFn: () => aiApi.getDownPayment(applicationId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-4">Failed to load down payment analysis.</p>;
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-16">
        <Landmark size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">No bank statements processed</p>
        <p className="text-xs text-slate-400 mt-1">Upload bank statements and run AI Review to analyze down payment sources.</p>
      </div>
    );
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const flaggedCount = entries.filter((e) => e.isFlagged).length;
  const loeCount = entries.filter((e) => e.loeRequired).length;

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Sourced</p>
          <p className="text-lg font-semibold text-slate-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Total Flagged</p>
          <p className="text-lg font-semibold text-amber-700">{flaggedCount}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <p className="text-xs text-slate-500 mb-1">Requires LOE</p>
          <p className="text-lg font-semibold text-blue-700">{loeCount}</p>
        </div>
      </div>

      {/* Transaction table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Running Balance</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => {
              const catCfg = CATEGORY_CONFIG[entry.category];
              const isExpanded = expanded[entry.id];

              return (
                <>
                  <tr
                    key={entry.id}
                    className={cn(
                      'transition-colors cursor-pointer',
                      entry.isFlagged ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'
                    )}
                    onClick={() => (entry.flagReason || entry.loeDraftText) && toggleExpanded(entry.id)}
                  >
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(entry.transactionDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-900 max-w-[200px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{entry.description}</span>
                        {(entry.flagReason || entry.loeDraftText) && (
                          <span className="flex-shrink-0 text-slate-400">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatCurrency(entry.runningBalance)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', catCfg.className)}>
                        {catCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.isFlagged && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Flagged
                        </span>
                      )}
                      {entry.loeRequired && (
                        <span className="ml-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          LOE
                        </span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${entry.id}-expanded`} className={entry.isFlagged ? 'bg-amber-50' : 'bg-slate-50'}>
                      <td colSpan={6} className="px-6 py-3">
                        <div className="space-y-2">
                          {entry.flagReason && (
                            <div>
                              <p className="text-xs font-medium text-amber-700 mb-0.5">Flag Reason</p>
                              <p className="text-sm text-slate-700">{entry.flagReason}</p>
                            </div>
                          )}
                          {entry.loeDraftText && (
                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <p className="text-xs font-medium text-blue-700">LOE Draft</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void navigator.clipboard.writeText(entry.loeDraftText ?? '');
                                    toast.success('Copied to clipboard');
                                  }}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  <Copy size={12} />
                                  Copy
                                </button>
                              </div>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{entry.loeDraftText}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
