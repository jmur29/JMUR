import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import {
  FileText, CheckCircle, Clock, TrendingUp,
  Upload, ArrowUpRight, Plus, AlertCircle,
} from 'lucide-react';
import { applicationsApi, adminApi, intakeApi } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import Spinner from '../components/ui/Spinner';
import { formatDate, formatPercent, getPrimaryBorrower, cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Persona = 'broker' | 'underwriter';

const PIPELINE_STEPS = [
  'Unpacking',
  'Classifying',
  'Extracting',
  'Building report',
];

// ---------------------------------------------------------------------------
// Score color helper
// ---------------------------------------------------------------------------
function scoreColor(score: number): string {
  if (score >= 85) return 'text-[#1B4332]';
  if (score >= 65) return 'text-[#92400E]';
  return 'text-[#991B1B]';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-[#D1FAE5]';
  if (score >= 65) return 'bg-[#FEF3C7]';
  return 'bg-[#FEE2E2]';
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({ label, value, icon }: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#6B6860] uppercase tracking-wide font-medium mb-1">{label}</p>
          <p className="text-2xl font-mono font-bold text-[#1B4332]">{value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg bg-[#D1FAE5] flex items-center justify-center text-[#1B4332]">
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zip Drop Zone (Broker)
// ---------------------------------------------------------------------------
function ZipDropZone() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles(arr);
    setError(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(e.target.files);
  }, [handleFiles]);

  const processFiles = useCallback(async () => {
    if (!files.length) return;
    setUploading(true);
    setStepIdx(0);
    setProgress(0);
    setError(null);

    // Animate steps
    stepIntervalRef.current = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, PIPELINE_STEPS.length - 1));
    }, 1800);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      const result = await intakeApi.uploadZip(formData, setProgress);
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      navigate(`/applications/${result.applicationId}`);
    } catch (err: unknown) {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      setUploading(false);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }, [files, navigate]);

  useEffect(() => () => {
    if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
  }, []);

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold text-[#1A1916] mb-4">Submit Client Documents</h2>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          dragOver
            ? 'border-[#1B4332] bg-[#D1FAE5]'
            : 'border-[#E8E6E1] bg-[#F7F6F3] hover:border-[#1B4332] hover:bg-[#D1FAE5]/30',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".zip,.pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={onFileInput}
        />
        <Upload size={28} className="mx-auto mb-3 text-[#6B6860]" />
        <p className="text-sm font-medium text-[#1A1916] mb-1">Drop client documents here</p>
        <p className="text-xs text-[#6B6860]">ZIP, PDF, JPG, PNG — any format</p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="btn-primary mt-4 text-xs"
        >
          Browse files
        </button>
      </div>

      {/* Selected files */}
      {files.length > 0 && !uploading && (
        <div className="mt-3 space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#6B6860]">
              <FileText size={12} className="text-[#1B4332]" />
              <span className="truncate">{f.name}</span>
              <span className="text-[#6B6860] ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
          <button onClick={processFiles} className="btn-primary mt-3 w-full text-sm">
            Process with AI
          </button>
        </div>
      )}

      {/* Processing animation */}
      {uploading && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-[#6B6860] mb-2">
            <Spinner size="sm" />
            <span>Processing... {progress > 0 ? `${progress}%` : ''}</span>
          </div>
          <div className="space-y-1.5">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step} className={cn(
                'flex items-center gap-2 text-xs transition-all',
                i < stepIdx ? 'text-[#1B4332]' : i === stepIdx ? 'text-[#1A1916] font-medium' : 'text-[#E8E6E1]'
              )}>
                <div className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px]',
                  i < stepIdx ? 'bg-[#1B4332] text-white' : i === stepIdx ? 'bg-[#1A1916] text-white animate-pulse' : 'bg-[#E8E6E1] text-[#6B6860]'
                )}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[#991B1B] bg-[#FEE2E2] rounded-lg px-3 py-2">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Broker View
// ---------------------------------------------------------------------------
function BrokerView({ stats, statsLoading, apps, appsLoading }: {
  stats: { totalApplications: number; approvedThisMonth: number; inReview: number; avgGds: number; approvalRate: number } | undefined;
  statsLoading: boolean;
  apps: { data: import('../types').Application[] } | undefined;
  appsLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Zip Drop */}
      <ZipDropZone />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-24 skeleton" />
          ))
        ) : (
          <>
            <StatCard label="Total Files" value={stats?.totalApplications ?? 0} icon={<FileText size={16} />} />
            <StatCard label="In Review" value={stats?.inReview ?? 0} icon={<Clock size={16} />} />
            <StatCard label="Approved (Month)" value={stats?.approvedThisMonth ?? 0} icon={<CheckCircle size={16} />} />
            <StatCard label="Avg GDS" value={stats ? formatPercent(stats.avgGds) : '—'} icon={<TrendingUp size={16} />} />
          </>
        )}
      </div>

      {/* Recent submissions */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E6E1]">
          <h2 className="text-sm font-semibold text-[#1A1916]">Recent Submissions</h2>
          <Link to="/applications" className="text-xs text-[#1B4332] font-medium flex items-center gap-1 hover:underline">
            View all <ArrowUpRight size={11} />
          </Link>
        </div>

        {appsLoading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : !apps?.data.length ? (
          <div className="text-center py-14 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7F6F3] flex items-center justify-center mx-auto">
              <FileText size={18} className="text-[#6B6860]" />
            </div>
            <p className="text-sm font-medium text-[#1A1916]">No submissions yet</p>
            <p className="text-xs text-[#6B6860]">Drop documents above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E6E1] bg-[#F7F6F3]">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">File #</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Borrower</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden md:table-cell">Readiness</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Status</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden lg:table-cell">Date</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6E1]">
                {apps.data.map((app) => {
                  const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
                  const score = app.dealIntelligenceReport?.readinessScore?.total ?? null;
                  return (
                    <tr key={app.id} className="table-row-hover">
                      <td className="px-5 py-3 font-mono text-xs text-[#6B6860]">{app.fileNumber}</td>
                      <td className="px-3 py-3 font-medium text-[#1A1916]">
                        {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#6B6860] hidden sm:table-cell">
                        {app.mortgageTerms?.mortgageType ?? '—'}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {score !== null ? (
                          <span className={cn('font-mono font-bold text-sm px-2 py-0.5 rounded-md', scoreColor(score), scoreBg(score))}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-xs text-[#6B6860]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={app.status} /></td>
                      <td className="px-3 py-3 text-xs text-[#6B6860] hidden lg:table-cell">{formatDate(app.createdAt)}</td>
                      <td className="px-3 py-3">
                        <Link to={`/applications/${app.id}`} className="text-[#6B6860] hover:text-[#1B4332]">
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Underwriter View
// ---------------------------------------------------------------------------
function UnderwriterView({ stats, statsLoading, apps, appsLoading }: {
  stats: { totalApplications: number; approvedThisMonth: number; inReview: number; avgGds: number; approvalRate: number } | undefined;
  statsLoading: boolean;
  apps: { data: import('../types').Application[] } | undefined;
  appsLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Import options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/import?tab=finmo" className="card p-5 hover:border-[#1B4332] transition-colors group">
          <div className="w-8 h-8 rounded-lg bg-[#D1FAE5] flex items-center justify-center mb-3">
            <Upload size={16} className="text-[#1B4332]" />
          </div>
          <h3 className="text-sm font-semibold text-[#1A1916] mb-1">Upload Finmo PDF</h3>
          <p className="text-xs text-[#6B6860]">Import a deal directly from a Finmo-generated PDF export</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[#1B4332] font-medium group-hover:underline">
            Open <ArrowUpRight size={11} />
          </span>
        </Link>

        <Link to="/import?tab=notes" className="card p-5 hover:border-[#1B4332] transition-colors group">
          <div className="w-8 h-8 rounded-lg bg-[#D1FAE5] flex items-center justify-center mb-3">
            <FileText size={16} className="text-[#1B4332]" />
          </div>
          <h3 className="text-sm font-semibold text-[#1A1916] mb-1">Paste Submission Notes</h3>
          <p className="text-xs text-[#6B6860]">Paste broker notes, Velocity summaries, or any deal text</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[#1B4332] font-medium group-hover:underline">
            Open <ArrowUpRight size={11} />
          </span>
        </Link>

        <Link to="/applications/new" className="card p-5 hover:border-[#1B4332] transition-colors group">
          <div className="w-8 h-8 rounded-lg bg-[#F7F6F3] flex items-center justify-center mb-3">
            <Plus size={16} className="text-[#6B6860]" />
          </div>
          <h3 className="text-sm font-semibold text-[#1A1916] mb-1">Manual Entry</h3>
          <p className="text-xs text-[#6B6860]">Enter all borrower, property, and mortgage details manually</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs text-[#1B4332] font-medium group-hover:underline">
            Open <ArrowUpRight size={11} />
          </span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 h-24 skeleton" />
          ))
        ) : (
          <>
            <StatCard label="Total Files" value={stats?.totalApplications ?? 0} icon={<FileText size={16} />} />
            <StatCard label="In Review" value={stats?.inReview ?? 0} icon={<Clock size={16} />} />
            <StatCard label="Approved (Month)" value={stats?.approvedThisMonth ?? 0} icon={<CheckCircle size={16} />} />
            <StatCard label="Avg GDS" value={stats ? formatPercent(stats.avgGds) : '—'} icon={<TrendingUp size={16} />} />
          </>
        )}
      </div>

      {/* Recent deals */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E8E6E1]">
          <h2 className="text-sm font-semibold text-[#1A1916]">Recent Deals</h2>
          <Link to="/applications" className="text-xs text-[#1B4332] font-medium flex items-center gap-1 hover:underline">
            View all <ArrowUpRight size={11} />
          </Link>
        </div>

        {appsLoading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : !apps?.data.length ? (
          <div className="text-center py-14">
            <p className="text-sm font-medium text-[#1A1916]">No deals yet</p>
            <p className="text-xs text-[#6B6860] mt-1">Import a deal above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E6E1] bg-[#F7F6F3]">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">File #</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Borrower</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden sm:table-cell">GDS</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden sm:table-cell">TDS</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden md:table-cell">LTV</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden md:table-cell">Score</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Decision</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide hidden lg:table-cell">Date</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E6E1]">
                {apps.data.map((app) => {
                  const primary = app.borrowers.length ? getPrimaryBorrower(app.borrowers) : null;
                  const latest = app.decisions?.[0];
                  const score = app.dealReviewReport?.dealQualityScore?.total ?? null;
                  return (
                    <tr key={app.id} className="table-row-hover">
                      <td className="px-5 py-3 font-mono text-xs text-[#6B6860]">{app.fileNumber}</td>
                      <td className="px-3 py-3 font-medium text-[#1A1916]">
                        {primary ? `${primary.firstName} ${primary.lastName}` : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs hidden sm:table-cell">
                        {latest ? formatPercent(Number(latest.gds)) : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs hidden sm:table-cell">
                        {latest ? formatPercent(Number(latest.tds)) : '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs hidden md:table-cell">
                        {latest ? formatPercent(Number(latest.ltv)) : '—'}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {score !== null ? (
                          <span className={cn('font-mono font-bold text-sm px-2 py-0.5 rounded-md', scoreColor(score), scoreBg(score))}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-xs text-[#6B6860]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={app.status} /></td>
                      <td className="px-3 py-3 text-xs text-[#6B6860] hidden lg:table-cell">{formatDate(app.createdAt)}</td>
                      <td className="px-3 py-3">
                        <Link to={`/applications/${app.id}`} className="text-[#6B6860] hover:text-[#1B4332]">
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const { user } = useUser();
  const [persona, setPersona] = useState<Persona>('broker');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pipeline-stats'],
    queryFn: adminApi.getPipelineStats,
  });

  const { data: apps, isLoading: appsLoading } = useQuery({
    queryKey: ['applications', 'dashboard'],
    queryFn: () => applicationsApi.list({ page: 1, pageSize: 8 }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1916]">
            Good day, {user?.firstName ?? 'there'}
          </h1>
          <p className="text-sm text-[#6B6860] mt-0.5">Your mortgage pipeline at a glance.</p>
        </div>

        {/* Persona toggle */}
        <div className="flex items-center gap-1 bg-[#F7F6F3] border border-[#E8E6E1] rounded-lg p-1">
          <button
            onClick={() => setPersona('broker')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              persona === 'broker'
                ? 'bg-[#1B4332] text-white'
                : 'text-[#6B6860] hover:text-[#1A1916] border border-transparent'
            )}
          >
            Broker
          </button>
          <button
            onClick={() => setPersona('underwriter')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              persona === 'underwriter'
                ? 'bg-[#1B4332] text-white'
                : 'text-[#6B6860] hover:text-[#1A1916] border border-transparent'
            )}
          >
            Underwriter
          </button>
        </div>
      </div>

      {persona === 'broker' ? (
        <BrokerView stats={stats} statsLoading={statsLoading} apps={apps} appsLoading={appsLoading} />
      ) : (
        <UnderwriterView stats={stats} statsLoading={statsLoading} apps={apps} appsLoading={appsLoading} />
      )}
    </div>
  );
}
