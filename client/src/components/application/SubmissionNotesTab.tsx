import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, FileCheck, Send, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/utils';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

interface SubmissionNotesTabProps {
  applicationId: string;
}

export default function SubmissionNotesTab({ applicationId }: SubmissionNotesTabProps) {
  const queryClient = useQueryClient();
  const [lenderTarget, setLenderTarget] = useState('');
  const [draftText, setDraftText] = useState('');

  const { data: notes, isLoading } = useQuery({
    queryKey: ['submission-notes', applicationId],
    queryFn: () => aiApi.getSubmissionNotes(applicationId),
  });

  // Sync editable text when notes load
  useEffect(() => {
    if (notes?.draftText) setDraftText(notes.draftText);
    if (notes?.lenderTarget) setLenderTarget(notes.lenderTarget);
  }, [notes]);

  const generateMutation = useMutation({
    mutationFn: () => aiApi.generateSubmissionNotes(applicationId, lenderTarget),
    onSuccess: (data) => {
      setDraftText(data.draftText);
      void queryClient.invalidateQueries({ queryKey: ['submission-notes', applicationId] });
      toast.success('Submission notes generated');
    },
    onError: () => toast.error('Failed to generate submission notes'),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => aiApi.finalizeSubmissionNotes(applicationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['submission-notes', applicationId] });
      toast.success('Submission notes finalized');
    },
    onError: () => toast.error('Failed to finalize submission notes'),
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftText);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const isFinalized = notes?.isFinalized ?? false;

  return (
    <div className="space-y-5">
      {/* Lender target + generate */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 mb-1">Lender Target</label>
          <input
            type="text"
            value={lenderTarget}
            onChange={(e) => setLenderTarget(e.target.value)}
            disabled={isFinalized}
            placeholder="e.g. TD Bank, First National, MCAP..."
            className={cn(
              'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              isFinalized && 'bg-slate-50 cursor-not-allowed text-slate-500'
            )}
          />
        </div>
        <Button
          leftIcon={<Wand2 size={14} />}
          loading={generateMutation.isPending}
          disabled={!lenderTarget.trim() || isFinalized}
          onClick={() => generateMutation.mutate()}
        >
          Generate
        </Button>
      </div>

      {/* Finalized badge */}
      {isFinalized && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <FileCheck size={16} className="text-green-600" />
          <span className="text-sm font-medium text-green-700">Finalized</span>
          {notes?.finalizedAt && (
            <span className="text-xs text-green-600">— {formatDateTime(notes.finalizedAt)}</span>
          )}
        </div>
      )}

      {/* Draft text */}
      {(draftText || notes) ? (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Draft Notes</label>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              readOnly={isFinalized}
              rows={10}
              className={cn(
                'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y',
                isFinalized && 'bg-slate-50 cursor-default text-slate-700'
              )}
            />
          </div>

          {/* Anticipated conditions */}
          {notes?.anticipatedConditions && notes.anticipatedConditions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Anticipated Conditions</p>
              <ul className="space-y-1">
                {notes.anticipatedConditions.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 justify-between">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy size={14} />}
              onClick={handleCopy}
              disabled={!draftText}
            >
              Copy to Clipboard
            </Button>
            {!isFinalized && (
              <Button
                leftIcon={<Send size={14} />}
                loading={finalizeMutation.isPending}
                disabled={!draftText}
                onClick={() => finalizeMutation.mutate()}
              >
                Finalize
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500 text-sm">
          No submission notes yet. Enter lender target and generate.
        </div>
      )}
    </div>
  );
}
