import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Shield, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/utils';
import type { FraudSignal, FraudSeverity } from '../../types';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

interface FraudSignalsTabProps {
  applicationId: string;
  isUnderwriter: boolean;
}

const SEVERITY_CONFIG: Record<FraudSeverity, { label: string; headerClass: string; cardClass: string; badgeClass: string }> = {
  HIGH: {
    label: 'High',
    headerClass: 'text-red-700 border-red-300 bg-red-50',
    cardClass: 'border-red-200 bg-red-50',
    badgeClass: 'bg-red-100 text-red-700',
  },
  MEDIUM: {
    label: 'Medium',
    headerClass: 'text-amber-700 border-amber-300 bg-amber-50',
    cardClass: 'border-amber-200 bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  LOW: {
    label: 'Low',
    headerClass: 'text-slate-600 border-slate-300 bg-slate-50',
    cardClass: 'border-slate-200 bg-slate-50',
    badgeClass: 'bg-slate-100 text-slate-600',
  },
};

function SignalCard({
  signal,
  isUnderwriter,
  onAcknowledge,
  isAcknowledging,
}: {
  signal: FraudSignal;
  isUnderwriter: boolean;
  onAcknowledge: (id: string) => void;
  isAcknowledging: boolean;
}) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(signal.evidence.length <= 200);
  const cfg = SEVERITY_CONFIG[signal.severity];

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', cfg.cardClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', cfg.badgeClass)}>
            {signal.signalType}
          </span>
          <span className="text-xs text-slate-500">{signal.documentName}</span>
        </div>
        {signal.acknowledgedAt && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-green-700">
            <ShieldCheck size={14} />
            Reviewed {formatDateTime(signal.acknowledgedAt)}
          </span>
        )}
      </div>

      {/* Evidence */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">Evidence</p>
        <p className={cn('text-sm text-slate-700', !evidenceExpanded && 'line-clamp-3')}>
          {signal.evidence}
        </p>
        {signal.evidence.length > 200 && (
          <button
            onClick={() => setEvidenceExpanded(!evidenceExpanded)}
            className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-700"
          >
            {evidenceExpanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
          </button>
        )}
      </div>

      {/* AI explanation */}
      <div>
        <p className="text-xs font-medium text-slate-600 mb-1">AI Explanation</p>
        <p className="text-sm text-slate-700">{signal.aiExplanation}</p>
      </div>

      {/* Recommended action */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">Recommended Action</p>
          <p className="text-sm text-slate-700">{signal.recommendedAction}</p>
        </div>
        {isUnderwriter && !signal.acknowledgedAt && (
          <Button
            size="sm"
            variant="secondary"
            loading={isAcknowledging}
            onClick={() => onAcknowledge(signal.id)}
            className="flex-shrink-0"
          >
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FraudSignalsTab({ applicationId, isUnderwriter }: FraudSignalsTabProps) {
  const queryClient = useQueryClient();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const { data: signals, isLoading, error } = useQuery({
    queryKey: ['fraud-signals', applicationId],
    queryFn: () => aiApi.getFraudSignals(applicationId),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (signalId: string) => {
      setAcknowledging(signalId);
      return aiApi.acknowledgeFraudSignal(applicationId, signalId);
    },
    onSuccess: () => {
      toast.success('Signal acknowledged');
      void queryClient.invalidateQueries({ queryKey: ['fraud-signals', applicationId] });
      setAcknowledging(null);
    },
    onError: () => {
      toast.error('Failed to acknowledge signal');
      setAcknowledging(null);
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-4">Failed to load fraud signals.</p>;
  }

  if (!signals || signals.length === 0) {
    return (
      <div className="text-center py-16">
        <Shield size={36} className="mx-auto text-green-400 mb-3" />
        <p className="text-slate-500 text-sm font-medium">No fraud signals detected</p>
        <p className="text-xs text-slate-400 mt-1">Run AI Review to check for potential fraud indicators.</p>
      </div>
    );
  }

  const grouped: Record<FraudSeverity, FraudSignal[]> = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const s of signals) {
    grouped[s.severity].push(s);
  }

  const hasUnacknowledgedHigh = grouped.HIGH.some((s) => !s.acknowledgedAt);

  return (
    <div className="space-y-6">
      {hasUnacknowledgedHigh && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>Requires underwriter acknowledgment before approval</span>
        </div>
      )}

      {(['HIGH', 'MEDIUM', 'LOW'] as FraudSeverity[]).map((severity) => {
        const group = grouped[severity];
        if (group.length === 0) return null;
        const cfg = SEVERITY_CONFIG[severity];

        return (
          <section key={severity}>
            <h3
              className={cn(
                'flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-t-lg border',
                cfg.headerClass
              )}
            >
              <AlertTriangle size={14} />
              {cfg.label} Severity ({group.length})
            </h3>
            <div className="space-y-3 mt-2">
              {group.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  isUnderwriter={isUnderwriter}
                  onAcknowledge={(id) => acknowledgeMutation.mutate(id)}
                  isAcknowledging={acknowledging === signal.id && acknowledgeMutation.isPending}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
