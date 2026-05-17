import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Send,
  AlertTriangle,
  Copy,
  ExternalLink,
  Play,
  Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { applicationsApi, dashboardApi, aiApi, pipelineApi } from '../../lib/api';
import { formatDate, getPrimaryBorrower } from '../../lib/utils';
import { StatCard } from '../ui/Card';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import GDSTDSIndicator from '../ui/GDSTDSIndicator';
import ApplicationStatusPill from '../ui/ApplicationStatusPill';
import ProcessingPipeline from '../ui/ProcessingPipeline';
import type { Application } from '../../types';

// ─── Quick Submission Notes Draft ────────────────────────────────────────────

function SubmissionNotesDraft({ applications }: { applications: Application[] }) {
  const [selectedAppId, setSelectedAppId] = useState('');
  const [lenderTarget, setLenderTarget] = useState('');
  const [generatedText, setGeneratedText] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => aiApi.generateSubmissionNotes(selectedAppId, lenderTarget),
    onSuccess: (data) => {
      setGeneratedText(data.draftText);
      toast.success('Submission notes generated');
    },
    onError: () => toast.error('Failed to generate submission notes'),
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-4">Submission Notes Quick Draft</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Application</label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select application...</option>
              {applications.map((app) => {
                const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
                return (
                  <option key={app.id} value={app.id}>
                    {app.fileNumber}{primary ? ` — ${primary.firstName} ${primary.lastName}` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lender Target</label>
            <input
              type="text"
              value={lenderTarget}
              onChange={(e) => setLenderTarget(e.target.value)}
              placeholder="e.g. TD Bank, First National..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <Button
          leftIcon={<Wand2 size={14} />}
          loading={generateMutation.isPending}
          disabled={!selectedAppId || !lenderTarget.trim()}
          onClick={() => generateMutation.mutate()}
        >
          Generate
        </Button>
        {generatedText && (
          <div className="space-y-2">
            <textarea
              value={generatedText}
              onChange={(e) => setGeneratedText(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Copy size={13} />}
              onClick={() => {
                void navigator.clipboard.writeText(generatedText);
                toast.success('Copied');
              }}
            >
              Copy to Clipboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BrokerDashboard ──────────────────────────────────────────────────────────

export default function BrokerDashboard() {
  const navigate = useNavigate();
  const [pipelineAppId, setPipelineAppId] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['broker-stats'],
    queryFn: dashboardApi.getBrokerStats,
  });

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ['applications', 'broker-active'],
    queryFn: () => applicationsApi.list({ pageSize: 50 }),
  });

  const applications = appsData?.data ?? [];

  const handleRunAiReview = async (appId: string) => {
    try {
      await pipelineApi.start(appId);
      setPipelineAppId(appId);
    } catch {
      toast.error('Failed to start AI Review');
    }
  };

  const handleCopySubmissionNotes = async (appId: string) => {
    try {
      const notes = await aiApi.getSubmissionNotes(appId);
      if (!notes?.draftText) {
        toast.error('No submission notes available for this application');
        return;
      }
      await navigator.clipboard.writeText(notes.draftText);
      toast.success('Submission notes copied');
    } catch {
      toast.error('Failed to copy submission notes');
    }
  };

  // Applications with open flags (we don't have fraud data per row, so filter by status heuristic)
  const flaggedApps = applications.filter(
    (app) => app.status === 'IN_REVIEW' || app.status === 'DRAFT'
  );

  return (
    <div className="space-y-6">
      {/* Pipeline modal */}
      <Modal
        isOpen={!!pipelineAppId}
        onClose={() => setPipelineAppId(null)}
        title="AI Review in Progress"
        size="md"
      >
        {pipelineAppId && (
          <ProcessingPipeline
            applicationId={pipelineAppId}
            onComplete={() => {
              setPipelineAppId(null);
              toast.success('AI Review complete');
            }}
          />
        )}
      </Modal>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 h-28 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Files" value={stats?.activeFiles ?? 0} icon={<FileText size={20} />} />
          <StatCard label="Submitted This Month" value={stats?.submittedThisMonth ?? 0} icon={<Send size={20} />} />
          <StatCard
            label="Avg Conditions / File"
            value={stats?.avgConditionsPerFile?.toFixed(1) ?? '—'}
            icon={<FileText size={20} />}
          />
          <StatCard
            label="Files With Open Flags"
            value={stats?.filesWithOpenFlags ?? 0}
            icon={<AlertTriangle size={20} />}
          />
        </div>
      )}

      {/* Active Files Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Active Files</h2>
          <Button size="sm" leftIcon={<FileText size={14} />} onClick={() => navigate('/applications/new')}>
            New Application
          </Button>
        </div>

        {appsLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : applications.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No active files found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Borrower</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Property</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Lender Target</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">GDS/TDS</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => {
                  const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
                  const latestDecision = app.decisions[app.decisions.length - 1];

                  return (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                        <p className="text-xs text-slate-400 font-mono">{app.fileNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                        {app.property ? `${app.property.city}, ${app.property.province}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">—</td>
                      <td className="px-4 py-3">
                        <ApplicationStatusPill status={app.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {latestDecision ? (
                          <GDSTDSIndicator gds={latestDecision.gds} tds={latestDecision.tds} compact />
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link to={`/applications/${app.id}`}>
                            <Button size="sm" variant="ghost" leftIcon={<ExternalLink size={13} />}>
                              View
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<Play size={13} />}
                            onClick={() => void handleRunAiReview(app.id)}
                          >
                            AI
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={<Copy size={13} />}
                            onClick={() => void handleCopySubmissionNotes(app.id)}
                          >
                            Notes
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flags panel */}
      {flaggedApps.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-amber-100 bg-amber-50">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Files Requiring Attention</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {flaggedApps.slice(0, 8).map((app) => {
              const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
              return (
                <li key={app.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                    </p>
                    <p className="text-xs text-slate-400">{app.fileNumber} · {formatDate(app.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ApplicationStatusPill status={app.status} />
                    <Link to={`/applications/${app.id}`}>
                      <Button size="sm" variant="ghost" leftIcon={<ExternalLink size={13} />}>
                        Open
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Submission Notes Quick Draft */}
      <SubmissionNotesDraft applications={applications} />
    </div>
  );
}
