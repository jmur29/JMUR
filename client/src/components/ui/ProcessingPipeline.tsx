import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { pipelineApi } from '../../lib/api';
import type { PipelineStage } from '../../types';

interface ProcessingPipelineProps {
  applicationId: string;
  onComplete?: () => void;
}

const STAGES: { stage: PipelineStage; label: string }[] = [
  { stage: 'OCR', label: 'OCR' },
  { stage: 'CLASSIFYING', label: 'Classifying' },
  { stage: 'SOURCING_DOWN_PAYMENT', label: 'Sourcing Down Payment' },
  { stage: 'FRAUD_CHECK', label: 'Fraud Check' },
  { stage: 'GENERATING_CREDIT_MEMO', label: 'Generating Credit Memo' },
  { stage: 'COMPLETE', label: 'Complete' },
];

const STAGE_ORDER: PipelineStage[] = [
  'PENDING',
  'OCR',
  'CLASSIFYING',
  'SOURCING_DOWN_PAYMENT',
  'FRAUD_CHECK',
  'GENERATING_CREDIT_MEMO',
  'COMPLETE',
  'ERROR',
];

function stageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export default function ProcessingPipeline({ applicationId, onComplete }: ProcessingPipelineProps) {
  const { data: status, error } = useQuery({
    queryKey: ['pipeline-status', applicationId],
    queryFn: () => pipelineApi.getStatus(applicationId),
    refetchInterval: (query) => {
      const stage = query.state.data?.stage;
      if (!stage || stage === 'COMPLETE' || stage === 'ERROR') return false;
      return 2000;
    },
  });

  useEffect(() => {
    if (status?.stage === 'COMPLETE') {
      onComplete?.();
    }
  }, [status?.stage, onComplete]);

  const currentStageIdx = status ? stageIndex(status.stage) : 0;
  const isError = status?.stage === 'ERROR';

  return (
    <div className="space-y-4">
      {isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>An error occurred during processing. Please try again.</span>
        </div>
      )}

      <ol className="space-y-3">
        {STAGES.map(({ stage, label }) => {
          const stageIdx = stageIndex(stage);
          const isDone = currentStageIdx > stageIdx && !isError;
          const isActive = status?.stage === stage;
          const isPending = !isDone && !isActive;

          return (
            <li key={stage} className="flex items-center gap-3">
              <span className="flex-shrink-0">
                {isDone ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : isActive ? (
                  <Loader2 size={20} className="text-blue-500 animate-spin" />
                ) : (
                  <Circle size={20} className={cn(isPending ? 'text-slate-300' : 'text-slate-400')} />
                )}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  isDone ? 'text-green-700' : isActive ? 'text-blue-700' : 'text-slate-400'
                )}
              >
                {label}
              </span>
              {isActive && status?.progress !== undefined && (
                <span className="ml-auto text-xs text-slate-400">{status.progress}%</span>
              )}
            </li>
          );
        })}
      </ol>

      {status && !isError && (
        <div className="mt-2">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                status.stage === 'COMPLETE' ? 'bg-green-500' : 'bg-blue-500'
              )}
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">Failed to fetch pipeline status.</p>
      )}
    </div>
  );
}
