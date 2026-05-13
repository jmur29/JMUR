import { useState, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, CheckCircle2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { conditionsApi } from '../../lib/api';
import type { ApprovalCondition, Application } from '../../types';
import { cn } from '../../lib/utils';
import { formatDate } from '../../lib/utils';
import Button from '../ui/Button';

interface ConditionsPanelProps {
  application: Application;
}

function ConditionRow({
  condition,
  applicationId,
}: {
  condition: ApprovalCondition;
  applicationId: string;
}) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (cleared: boolean) =>
      conditionsApi.update(condition.id, { cleared }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conditions', applicationId] });
    },
    onError: () => toast.error('Failed to update condition'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => conditionsApi.delete(condition.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conditions', applicationId] });
      toast.success('Condition removed');
    },
    onError: () => toast.error('Failed to delete condition'),
  });

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0 group">
      {/* Checkbox */}
      <button
        onClick={() => updateMutation.mutate(!condition.cleared)}
        disabled={updateMutation.isPending}
        className={cn(
          'flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          condition.cleared
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-slate-300 hover:border-green-400'
        )}
        title={condition.cleared ? 'Mark as not cleared' : 'Mark as cleared'}
      >
        {condition.cleared && <CheckCircle2 size={13} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm text-slate-800',
            condition.cleared && 'line-through text-slate-400'
          )}
        >
          {condition.body}
        </p>
        {condition.cleared && condition.clearedBy && condition.clearedAt && (
          <p className="text-xs text-slate-400 mt-0.5">
            Cleared by {condition.clearedBy.firstName} {condition.clearedBy.lastName} on{' '}
            {formatDate(condition.clearedAt)}
          </p>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
        title="Remove condition"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function ConditionsPanel({ application }: ConditionsPanelProps) {
  const queryClient = useQueryClient();
  const [newBody, setNewBody] = useState('');

  const { data: conditions, isLoading } = useQuery({
    queryKey: ['conditions', application.id],
    queryFn: () => conditionsApi.list(application.id),
    enabled: !!application.id,
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => conditionsApi.create(application.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conditions', application.id] });
      setNewBody('');
    },
    onError: () => toast.error('Failed to add condition'),
  });

  const handleAdd = () => {
    const trimmed = newBody.trim();
    if (trimmed) {
      createMutation.mutate(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const allCleared =
    conditions && conditions.length > 0 && conditions.every((c) => c.cleared);
  const isConditionallyApproved = application.status === 'CONDITIONALLY_APPROVED';
  const clearedCount = conditions?.filter((c) => c.cleared).length ?? 0;
  const total = conditions?.length ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700">Conditions</h4>
        {total > 0 && (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              allCleared
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            )}
          >
            {clearedCount}/{total} cleared
          </span>
        )}
      </div>

      {/* All cleared banner */}
      {allCleared && isConditionallyApproved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-green-700">All conditions cleared</span>
        </div>
      )}

      {/* Add condition */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a condition…"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus size={14} />}
          loading={createMutation.isPending}
          disabled={!newBody.trim()}
          onClick={handleAdd}
        >
          Add
        </Button>
      </div>

      {/* Conditions list */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-5 h-5 rounded bg-slate-200 flex-shrink-0" />
              <div className="h-3 bg-slate-200 rounded flex-1" />
            </div>
          ))}
        </div>
      ) : !conditions || conditions.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">
          No conditions. Add one to track required items.
        </p>
      ) : (
        <div>
          {conditions.map((condition) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              applicationId={application.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
