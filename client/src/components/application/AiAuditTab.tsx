import { useQuery } from '@tanstack/react-query';
import { Download, ClipboardList } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { formatDateTime, downloadFile } from '../../lib/utils';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

interface AiAuditTabProps {
  applicationId: string;
}

export default function AiAuditTab({ applicationId }: AiAuditTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-audit', applicationId],
    queryFn: () =>
      adminApi.listAuditLogs({ applicationId, pageSize: 100 }),
  });

  const logs = data?.data ?? [];

  const handleExportCsv = () => {
    const header = 'Timestamp,Action,Model,Input Tokens,Output Tokens';
    const rows = logs.map((log) => {
      const meta = log.metadata as Record<string, unknown>;
      const model = String(meta.model ?? '');
      const inputTokens = String(meta.inputTokens ?? meta.input_tokens ?? '');
      const outputTokens = String(meta.outputTokens ?? meta.output_tokens ?? '');
      return [
        `"${formatDateTime(log.createdAt)}"`,
        `"${log.action}"`,
        `"${model}"`,
        inputTokens,
        outputTokens,
      ].join(',');
    });
    downloadFile([header, ...rows].join('\n'), `ai-audit-${applicationId}.csv`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 py-4">Failed to load AI audit log.</p>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-16">
        <ClipboardList size={36} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">No AI actions recorded for this application</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{logs.length} AI action{logs.length !== 1 ? 's' : ''} recorded</p>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Download size={14} />}
          onClick={handleExportCsv}
        >
          Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Input Tokens</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Output Tokens</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => {
              const meta = log.metadata as Record<string, unknown>;
              return (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{log.action}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                    {String(meta.model ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {String(meta.inputTokens ?? meta.input_tokens ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {String(meta.outputTokens ?? meta.output_tokens ?? '—')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
