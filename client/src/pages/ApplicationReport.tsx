import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Printer, Download, FileText } from 'lucide-react';
import { reportsApi, apiClient } from '../lib/api';
import { useApplication } from '../hooks/useApplication';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { downloadFile } from '../lib/utils';

export default function ApplicationReport() {
  const { id } = useParams<{ id: string }>();
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const { data: application } = useApplication(id ?? '');

  const generateMutation = useMutation({
    mutationFn: () => reportsApi.generate(id ?? ''),
    onSuccess: (data) => setReportUrl(data.url),
  });

  async function handleDownloadPdf() {
    if (!id) return;
    setPdfDownloading(true);
    try {
      const response = await apiClient.get(`/applications/${id}/report`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      const filename = `report-${application?.fileNumber ?? id}.pdf`;
      downloadFile(blob, filename, 'application/pdf');
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header — no-print in print mode */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link to={`/applications/${id}`}>
            <Button size="sm" variant="ghost" leftIcon={<ArrowLeft size={15} />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Report — {application?.fileNumber ?? '…'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Generate and download the underwriting summary report.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reportUrl && (
            <>
              <Button
                variant="secondary"
                leftIcon={<Download size={15} />}
                loading={pdfDownloading}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Printer size={15} />}
                onClick={() => window.print()}
              >
                Print
              </Button>
            </>
          )}
          <Button
            leftIcon={<FileText size={15} />}
            loading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {reportUrl ? 'Regenerate' : 'Generate Report'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {!reportUrl && !generateMutation.isPending && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center py-24 gap-4">
          <FileText size={48} className="text-slate-300" />
          <p className="text-slate-500 text-sm">
            Click "Generate Report" to create the underwriting summary PDF.
          </p>
          <Button
            leftIcon={<FileText size={15} />}
            onClick={() => generateMutation.mutate()}
          >
            Generate Report
          </Button>
        </div>
      )}

      {generateMutation.isPending && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" />
          <p className="text-slate-500 text-sm">Generating report…</p>
        </div>
      )}

      {generateMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 text-sm font-medium">
            Failed to generate report. Please try again.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() => generateMutation.mutate()}
          >
            Retry
          </Button>
        </div>
      )}

      {reportUrl && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
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
