import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle, AlertTriangle, XCircle, Clock, Send } from 'lucide-react';
import { underwritingApi } from '../../lib/api';
import type { Application, UWResult, ApplicationStatus } from '../../types';
import { appKeys, useCalculate } from '../../hooks/useApplication';
import FlagBadge from '../ui/FlagBadge';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { formatDate, formatPercent, getDecisionColor, getDecisionLabel, getStatusColor } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface DecisionTabProps {
  application: Application;
}

export default function DecisionTab({ application }: DecisionTabProps) {
  const queryClient = useQueryClient();
  const [uwResult, setUwResult] = useState<UWResult | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmDecline, setConfirmDecline] = useState(false);

  const calculateMutation = useCalculate(application.id);

  // Auto-run calculation on mount
  useEffect(() => {
    calculateMutation.mutate(undefined, {
      onSuccess: (data) => setUwResult(data),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decisionMutation = useMutation({
    mutationFn: ({ status }: { status: ApplicationStatus }) =>
      underwritingApi.saveDecision(application.id, { notes, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      toast.success('Decision recorded');
      setConfirmDecline(false);
    },
    onError: () => toast.error('Failed to record decision'),
  });

  const handleDecision = (status: ApplicationStatus) => {
    if (status === 'DECLINED' && !confirmDecline) {
      setConfirmDecline(true);
      return;
    }
    decisionMutation.mutate({ status });
  };

  const latestHistory = [...application.decisions].sort(
    (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime()
  );

  return (
    <div className="space-y-8">
      {/* Current calculation result */}
      {calculateMutation.isPending && !uwResult && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner size="sm" />
          Running underwriting calculation…
        </div>
      )}

      {uwResult && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              System Recommendation
            </h3>
            <span
              className={cn(
                'inline-flex items-center px-3 py-1 rounded-lg text-sm font-semibold',
                getDecisionColor(uwResult.decision)
              )}
            >
              {getDecisionLabel(uwResult.decision)}
            </span>
          </div>

          {/* Key ratios summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'GDS', value: formatPercent(uwResult.gds), threshold: 32, v: uwResult.gds },
              { label: 'TDS', value: formatPercent(uwResult.tds), threshold: 44, v: uwResult.tds },
              { label: 'LTV', value: formatPercent(uwResult.ltv), threshold: 80, v: uwResult.ltv },
              { label: 'Stress GDS', value: formatPercent(uwResult.stressGds), threshold: 32, v: uwResult.stressGds },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    item.v > item.threshold ? 'text-red-600' : 'text-green-600'
                  )}
                >
                  {item.value}
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    / {item.threshold}%
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Flags */}
          {uwResult.flags.length > 0 && (
            <div className="space-y-2 mb-5">
              {uwResult.flags.map((flag, i) => (
                <FlagBadge key={i} type={flag.type} message={flag.message} field={flag.field} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Underwriter notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Underwriter Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add conditions, observations, or rationale for decision…"
          rows={4}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
        />
      </div>

      {/* Decision buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Record Decision</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            leftIcon={<CheckCircle size={15} />}
            loading={decisionMutation.isPending && decisionMutation.variables?.status === 'APPROVED'}
            onClick={() => handleDecision('APPROVED')}
            className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            leftIcon={<AlertTriangle size={15} />}
            loading={decisionMutation.isPending && decisionMutation.variables?.status === 'CONDITIONALLY_APPROVED'}
            onClick={() => handleDecision('CONDITIONALLY_APPROVED')}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Conditionally Approve
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Send size={15} />}
            loading={decisionMutation.isPending && decisionMutation.variables?.status === 'IN_REVIEW'}
            onClick={() => handleDecision('IN_REVIEW')}
          >
            Send for Review
          </Button>

          {confirmDecline ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 font-medium">Confirm decline?</span>
              <Button
                variant="danger"
                size="sm"
                loading={decisionMutation.isPending && decisionMutation.variables?.status === 'DECLINED'}
                onClick={() => {
                  decisionMutation.mutate({ status: 'DECLINED' });
                }}
              >
                Yes, Decline
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDecline(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              leftIcon={<XCircle size={15} />}
              onClick={() => handleDecision('DECLINED')}
            >
              Decline
            </Button>
          )}
        </div>
      </div>

      {/* Decision history */}
      {latestHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Decision History</h4>
          <div className="space-y-3">
            {latestHistory.map((decision) => (
              <div
                key={decision.id}
                className="border border-slate-200 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getDecisionColor(decision.decision)
                      )}
                    >
                      {getDecisionLabel(decision.decision)}
                    </span>
                    {decision.status && (
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          getStatusColor(decision.status)
                        )}
                      >
                        {decision.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={12} />
                    {formatDate(decision.decidedAt)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <span>GDS: {formatPercent(decision.gds)}</span>
                  <span>TDS: {formatPercent(decision.tds)}</span>
                  <span>LTV: {formatPercent(decision.ltv)}</span>
                </div>
                {decision.notes && (
                  <p className="text-sm text-slate-600 border-t border-slate-100 pt-2">
                    {decision.notes}
                  </p>
                )}
                {decision.decidedBy && (
                  <p className="text-xs text-slate-400">
                    By {decision.decidedBy.firstName} {decision.decidedBy.lastName}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
