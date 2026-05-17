import { useQuery, useMutation } from '@tanstack/react-query';
import { Download, RefreshCw, FileText, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, pipelineApi } from '../../lib/api';
import { cn, formatCurrency, formatPercent } from '../../lib/utils';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import GDSTDSIndicator from '../ui/GDSTDSIndicator';

interface CreditMemoTabProps {
  applicationId: string;
}

export default function CreditMemoTab({ applicationId }: CreditMemoTabProps) {
  const { data: memo, isLoading, error, refetch } = useQuery({
    queryKey: ['credit-memo', applicationId],
    queryFn: () => aiApi.getCreditMemo(applicationId),
  });

  const pdfMutation = useMutation({
    mutationFn: () => aiApi.generateCreditMemoPdf(applicationId),
    onSuccess: (data) => {
      window.open(data.url, '_blank');
    },
    onError: () => toast.error('Failed to generate PDF'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => pipelineApi.start(applicationId),
    onSuccess: () => {
      toast.success('Regeneration started — refresh after a moment');
      setTimeout(() => void refetch(), 8000);
    },
    onError: () => toast.error('Failed to start regeneration'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-4">Failed to load credit memo.</p>;
  }

  if (!memo) {
    return (
      <div className="text-center py-16">
        <FileText size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">Credit memo not yet generated</p>
        <p className="text-xs text-slate-400 mt-1 mb-4">Run AI Review to generate the credit memo.</p>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<RefreshCw size={14} />}
          loading={regenerateMutation.isPending}
          onClick={() => regenerateMutation.mutate()}
        >
          Run AI Review
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-900">Credit Memo</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw size={14} />}
            loading={regenerateMutation.isPending}
            onClick={() => regenerateMutation.mutate()}
          >
            Regenerate
          </Button>
          <Button
            size="sm"
            leftIcon={<Download size={14} />}
            loading={pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            Download PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">GDS / TDS</p>
          <GDSTDSIndicator gds={memo.gds} tds={memo.tds} />
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Qualifying Rate</p>
          <p className="text-sm font-semibold text-slate-900">{formatPercent(memo.qualifyingRate)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Down Payment</p>
          <p className="text-sm font-semibold text-slate-900">{formatCurrency(memo.downPaymentTotal)}</p>
          <p className={cn('text-xs mt-0.5', memo.downPaymentSourced ? 'text-green-600' : 'text-amber-600')}>
            {memo.downPaymentSourced ? 'Fully sourced' : 'Not fully sourced'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Flags</p>
          <p className={cn('text-sm font-semibold', memo.flagCount > 0 ? 'text-amber-700' : 'text-green-700')}>
            {memo.flagCount}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Fraud Signals</p>
          <p className={cn('text-sm font-semibold', memo.fraudSignalCount > 0 ? 'text-red-700' : 'text-green-700')}>
            {memo.fraudSignalCount}
          </p>
        </div>
      </div>

      {/* Narrative */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Narrative</h4>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{memo.narrative}</p>
        </div>
      </div>

      {/* Recommended Conditions */}
      {memo.recommendedConditions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Recommended Conditions</h4>
          <ul className="space-y-2">
            {memo.recommendedConditions.map((condition, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckSquare size={16} className="flex-shrink-0 text-blue-500 mt-0.5" />
                {condition}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
