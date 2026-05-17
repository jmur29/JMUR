import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, pipelineApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

interface ClassifiedDocumentsTabProps {
  applicationId: string;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 90
      ? 'bg-green-100 text-green-700'
      : pct >= 70
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', cls)}>
      {pct}%
    </span>
  );
}

export default function ClassifiedDocumentsTab({ applicationId }: ClassifiedDocumentsTabProps) {
  const queryClient = useQueryClient();
  const [reclassifying, setReclassifying] = useState<string | null>(null);

  const { data: docs, isLoading, error } = useQuery({
    queryKey: ['classified-documents', applicationId],
    queryFn: () => aiApi.getClassifiedDocuments(applicationId),
  });

  const reclassifyMutation = useMutation({
    mutationFn: (docId: string) => {
      setReclassifying(docId);
      return pipelineApi.start(applicationId);
    },
    onSuccess: () => {
      toast.success('Re-classification started');
      void queryClient.invalidateQueries({ queryKey: ['classified-documents', applicationId] });
      setReclassifying(null);
    },
    onError: () => {
      toast.error('Failed to start re-classification');
      setReclassifying(null);
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
    return <p className="text-sm text-red-600 py-4">Failed to load classified documents.</p>;
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="text-center py-16">
        <Upload size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">No documents uploaded</p>
        <p className="text-xs text-slate-400 mt-1">Upload documents and run AI Review to classify them.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Document</th>
            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Classified As</th>
            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Confidence</th>
            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Key Fields</th>
            <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {docs.map((doc) => {
            const topFields = doc.classification
              ? Object.entries(doc.classification.extractedFields).slice(0, 3)
              : [];

            return (
              <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">
                  {doc.name}
                </td>
                <td className="px-4 py-3">
                  {doc.classification ? (
                    <span className="text-slate-700">{doc.classification.classifiedType}</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {doc.classification ? (
                    <ConfidenceBadge confidence={doc.classification.confidence} />
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {topFields.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {topFields.map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100"
                        >
                          <span className="font-medium">{key}:</span>
                          <span className="truncate max-w-[80px]">{value}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<RefreshCw size={13} />}
                    loading={reclassifying === doc.id && reclassifyMutation.isPending}
                    onClick={() => reclassifyMutation.mutate(doc.id)}
                  >
                    Re-classify
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
