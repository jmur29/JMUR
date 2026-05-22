import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Printer, Download, FileText, ChevronRight } from 'lucide-react';
import { reportsApi } from '../lib/api';
import { useApplication } from '../hooks/useApplication';
import Spinner from '../components/ui/Spinner';

export default function ApplicationReport() {
  const { id } = useParams<{ id: string }>();
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const { data: application } = useApplication(id ?? '');

  const generateMutation = useMutation({
    mutationFn: () => reportsApi.generate(id ?? ''),
    onSuccess: (data) => setReportUrl(data.url),
  });

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#6B6860]">
        <Link to="/applications" className="hover:text-[#1B4332] transition-colors">Files</Link>
        <ChevronRight size={14} />
        <Link to={`/applications/${id}`} className="font-mono hover:text-[#1B4332] transition-colors text-[#1A1916]">
          {application?.fileNumber ?? id}
        </Link>
        <ChevronRight size={14} />
        <span>Report</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/applications/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-[#6B6860] hover:text-[#1B4332] transition-colors"
          >
            <ArrowLeft size={15} />
            Back
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-[#1A1916]">
              Underwriting Report — <span className="font-mono">{application?.fileNumber ?? '…'}</span>
            </h1>
            <p className="text-sm text-[#6B6860] mt-0.5">Generate and download the underwriting summary report.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reportUrl && (
            <>
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E6E1] text-sm font-medium text-[#1A1916] hover:border-[#1B4332] hover:text-[#1B4332] transition-colors"
              >
                <Download size={14} /> Download PDF
              </a>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8E6E1] text-sm font-medium text-[#1A1916] hover:border-[#1B4332] hover:text-[#1B4332] transition-colors"
              >
                <Printer size={14} /> Print
              </button>
            </>
          )}
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1B4332] text-sm font-medium text-[#1B4332] hover:bg-[#D1FAE5] disabled:opacity-50 transition-colors"
          >
            {generateMutation.isPending ? <Spinner size="sm" /> : <FileText size={14} />}
            {reportUrl ? 'Regenerate' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* States */}
      {!reportUrl && !generateMutation.isPending && !generateMutation.isError && (
        <div className="card flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F7F6F3] flex items-center justify-center">
            <FileText size={26} className="text-[#6B6860]" />
          </div>
          <p className="text-sm text-[#6B6860]">Click "Generate Report" to create the underwriting summary PDF.</p>
          <button
            onClick={() => generateMutation.mutate()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <FileText size={14} /> Generate Report
          </button>
        </div>
      )}

      {generateMutation.isPending && (
        <div className="card flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-[#6B6860]">Generating report…</p>
        </div>
      )}

      {generateMutation.isError && (
        <div className="card border-[#FCA5A5] bg-[#FEF2F2] p-6 text-center">
          <p className="text-sm font-medium text-[#991B1B]">Failed to generate report. Please try again.</p>
          <button
            className="mt-3 btn-primary"
            onClick={() => generateMutation.mutate()}
          >
            Retry
          </button>
        </div>
      )}

      {reportUrl && (
        <div className="card overflow-hidden">
          <iframe
            src={reportUrl}
            title="Underwriting Report"
            className="w-full"
            style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
          />
        </div>
      )}
    </div>
  );
}
