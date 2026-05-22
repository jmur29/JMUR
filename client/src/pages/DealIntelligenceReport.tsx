import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle,
  Info, Sparkles, RefreshCw,
} from 'lucide-react';
import { intakeApi, apiClient } from '../lib/api';
import Spinner from '../components/ui/Spinner';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import type { ClassifiedDocument, DealIntelligenceReport as DealIntelligenceReportType } from '../types';

// ---------------------------------------------------------------------------
// Helpers
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

function ratioColor(value: number | null, limit: number): string {
  if (value === null) return 'text-[#6B6860]';
  return value <= limit ? 'text-[#1B4332]' : 'text-[#991B1B]';
}

function StatusIcon({ status }: { status: 'GOOD' | 'REVIEW' | 'MISSING' }) {
  if (status === 'GOOD') return <CheckCircle size={14} className="text-[#1B4332]" />;
  if (status === 'REVIEW') return <AlertTriangle size={14} className="text-[#92400E]" />;
  return <XCircle size={14} className="text-[#991B1B]" />;
}

function VerifyIcon({ status }: { status: 'PASS' | 'FAIL' | 'MISSING' | 'GOOD' | 'REVIEW' }) {
  if (status === 'PASS' || status === 'GOOD') return <CheckCircle size={14} className="text-[#1B4332]" />;
  if (status === 'MISSING') return <Info size={14} className="text-[#6B6860]" />;
  return <XCircle size={14} className="text-[#991B1B]" />;
}

// ---------------------------------------------------------------------------
// Document row (expandable)
// ---------------------------------------------------------------------------
function DocumentRow({ doc, isEven }: { doc: ClassifiedDocument; isEven: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr
        className={cn('cursor-pointer hover:bg-[#D1FAE5]/20 transition-colors', isEven ? 'bg-white' : 'bg-[#F7F6F3]')}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-5 py-3 text-sm text-[#1A1916] font-medium">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-[#6B6860]" /> : <ChevronRight size={14} className="text-[#6B6860]" />}
            {doc.filename}
          </div>
        </td>
        <td className="px-3 py-3 text-xs text-[#6B6860]">{doc.detectedType}</td>
        <td className="px-3 py-3 text-xs text-[#6B6860] max-w-xs truncate">{doc.keyDataExtracted}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <StatusIcon status={doc.status} />
            <span className={cn('text-xs font-medium',
              doc.status === 'GOOD' ? 'text-[#1B4332]' : doc.status === 'REVIEW' ? 'text-[#92400E]' : 'text-[#991B1B]'
            )}>
              {doc.status === 'GOOD' ? 'Good' : doc.status === 'REVIEW' ? 'Review' : 'Missing'}
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className={isEven ? 'bg-white' : 'bg-[#F7F6F3]'}>
          <td colSpan={4} className="px-5 pb-4 pt-1">
            <div className="rounded-lg border border-[#E8E6E1] bg-white p-4 text-xs text-[#6B6860] space-y-2">
              {doc.issues.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium text-[#92400E]">Issues:</p>
                  {doc.issues.map((issue, i) => (
                    <p key={i} className="flex items-start gap-1.5">
                      <AlertTriangle size={11} className="text-[#92400E] mt-0.5 flex-shrink-0" />
                      {issue}
                    </p>
                  ))}
                </div>
              )}
              <div>
                <p className="font-medium text-[#1A1916] mb-1">Extracted data:</p>
                <pre className="font-mono text-[10px] bg-[#F7F6F3] rounded p-2 overflow-x-auto">
                  {JSON.stringify(doc.extractedData, null, 2)}
                </pre>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="card p-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 skeleton rounded w-3/4" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 skeleton rounded w-1/2" />
            ))}
          </div>
        </div>
      </div>
      <div className="card p-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 skeleton rounded" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DealIntelligenceReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: report, isLoading, error } = useQuery<DealIntelligenceReportType>({
    queryKey: ['deal-intelligence', id],
    queryFn: () => intakeApi.getDealIntelligence(id!),
    enabled: !!id,
    retry: (_, err: unknown) => {
      const status = (err as { response?: { status: number } })?.response?.status;
      return status !== 404;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/applications/${id}/deal-intelligence`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-intelligence', id] }),
  });

  const is404 = !report && !isLoading && (error as { response?: { status: number } })?.response?.status === 404;

  if (isLoading) return <ReportSkeleton />;

  if (is404 || (!report && !isLoading)) {
    return (
      <div className="max-w-xl mx-auto card p-8 text-center space-y-4 mt-8">
        <div className="w-12 h-12 rounded-2xl bg-[#D1FAE5] flex items-center justify-center mx-auto">
          <Sparkles size={22} className="text-[#1B4332]" />
        </div>
        <h2 className="text-lg font-semibold text-[#1A1916]">Report Not Yet Generated</h2>
        <p className="text-sm text-[#6B6860]">
          No deal intelligence report found for this application. Run the AI analysis to generate one.
        </p>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="btn-primary inline-flex items-center gap-2"
        >
          {generateMutation.isPending ? (
            <><Spinner size="sm" />Generating...</>
          ) : (
            <><Sparkles size={14} />Generate Report</>
          )}
        </button>
        {generateMutation.isError && (
          <p className="text-xs text-[#991B1B]">Generation failed. Please try again.</p>
        )}
      </div>
    );
  }

  if (!report) return null;

  const totalScore = report.readinessScore.total;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1916]">Deal Intelligence Report</h1>
          <p className="text-sm text-[#6B6860] mt-0.5">AI-generated broker readiness report</p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="btn-primary inline-flex items-center gap-1.5 text-xs"
        >
          <RefreshCw size={12} className={generateMutation.isPending ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Section A — Deal Snapshot */}
      <div className="card p-6">
        <h2 className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-4">A — Deal Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#6B6860]">Deal Type</p>
              <p className="text-sm font-medium text-[#1A1916]">{report.dealType}</p>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Primary Lender Fit</p>
              <p className="text-sm font-medium text-[#1A1916]">{report.primaryLenderFit}</p>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Recommended Lenders</p>
              <p className="text-sm text-[#1A1916]">{report.recommendedLenders.join(', ') || '—'}</p>
            </div>
          </div>

          {/* Right */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-[#6B6860] mb-1">Readiness Score</p>
                <span className={cn(
                  'font-mono text-4xl font-bold',
                  scoreColor(totalScore)
                )}>
                  {totalScore}
                </span>
                <span className="text-sm text-[#6B6860] ml-1">/100</span>
              </div>
              <div>
                <p className="text-xs text-[#6B6860] mb-1">Lender Tier</p>
                <span className={cn(
                  'inline-block px-3 py-1 rounded-full text-xs font-semibold',
                  report.lenderTier === 'A' ? 'bg-[#D1FAE5] text-[#1B4332]' :
                  report.lenderTier === 'B' ? 'bg-[#FEF3C7] text-[#92400E]' :
                  'bg-[#FEE2E2] text-[#991B1B]'
                )}>
                  {report.lenderTier} Lender
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-[#6B6860] mb-1">AI Confidence</p>
              <span className={cn(
                'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
                report.confidence === 'HIGH' ? 'bg-[#D1FAE5] text-[#1B4332]' :
                report.confidence === 'MEDIUM' ? 'bg-[#FEF3C7] text-[#92400E]' :
                'bg-[#FEE2E2] text-[#991B1B]'
              )}>
                {report.confidence}
              </span>
            </div>
            {/* Score breakdown */}
            <div className="text-xs space-y-1 mt-2">
              <p className="font-medium text-[#1A1916]">Score Breakdown</p>
              {[
                ['Documents Complete', report.readinessScore.documentsComplete, 40],
                ['Income Verifiable', report.readinessScore.incomeVerifiable, 20],
                ['Down Payment Sourced', report.readinessScore.downPaymentSourced, 20],
                ['Liabilities Complete', report.readinessScore.liabilitiesComplete, 10],
                ['Identity Verified', report.readinessScore.identityVerified, 10],
              ].map(([label, val, max]) => (
                <div key={label as string} className="flex justify-between">
                  <span className="text-[#6B6860]">{label as string}</span>
                  <span className="font-mono font-medium text-[#1A1916]">{val as number}/{max as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section B — Document Inventory */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E8E6E1] bg-white">
          <h2 className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide">B — Document Inventory</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8E6E1] bg-[#F7F6F3]">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Document</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Type Detected</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Key Data</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-[#6B6860]">No documents</td>
                </tr>
              ) : (
                report.documents.map((doc, i) => (
                  <DocumentRow key={doc.filename + i} doc={doc} isEven={i % 2 === 0} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section C — Borrower Profile */}
      <div className="card p-6 space-y-6">
        <h2 className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide">C — Borrower Profile</h2>

        {/* Income */}
        <div>
          <p className="text-sm font-semibold text-[#1A1916] mb-3">Income</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {report.income.t4_2023 !== undefined && (
              <div>
                <p className="text-xs text-[#6B6860]">T4 2023</p>
                <p className="font-mono text-sm font-medium text-[#1A1916]">
                  {formatCurrency(report.income.t4_2023)}
                </p>
              </div>
            )}
            {report.income.t4_2022 !== undefined && (
              <div>
                <p className="text-xs text-[#6B6860]">T4 2022</p>
                <p className="font-mono text-sm font-medium text-[#1A1916]">
                  {formatCurrency(report.income.t4_2022)}
                </p>
              </div>
            )}
            {report.income.noaConfirmed !== undefined && (
              <div>
                <p className="text-xs text-[#6B6860]">NOA Confirmed</p>
                <p className="font-mono text-sm font-medium text-[#1A1916]">
                  {formatCurrency(report.income.noaConfirmed)}
                </p>
              </div>
            )}
            {report.income.twoYearAverage !== undefined && (
              <div>
                <p className="text-xs text-[#6B6860]">2-Year Average</p>
                <p className="font-mono text-sm font-medium text-[#1A1916]">
                  {formatCurrency(report.income.twoYearAverage)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-[#6B6860]">Monthly Qualifying</p>
              <p className="font-mono text-sm font-semibold text-[#1B4332]">
                {formatCurrency(report.income.monthlyQualifying)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Employment Verified</p>
              <div className="flex items-center gap-1 mt-0.5">
                <VerifyIcon status={report.income.employmentVerified ? 'PASS' : 'MISSING'} />
                <span className="text-sm font-medium">
                  {report.income.employmentVerified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Down Payment */}
        <div>
          <p className="text-sm font-semibold text-[#1A1916] mb-3">Down Payment</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#6B6860]">Total Sourced</p>
              <p className="font-mono text-sm font-medium text-[#1A1916]">
                {formatCurrency(report.downPayment.totalSourced)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Required</p>
              <p className="font-mono text-sm font-medium text-[#1A1916]">
                {formatCurrency(report.downPayment.required)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Unexplained Deposits</p>
              <div className="flex items-center gap-1 mt-0.5">
                {report.downPayment.unexplainedDeposits > 0 ? (
                  <AlertTriangle size={12} className="text-[#92400E]" />
                ) : (
                  <CheckCircle size={12} className="text-[#1B4332]" />
                )}
                <p className={cn('font-mono text-sm font-medium',
                  report.downPayment.unexplainedDeposits > 0 ? 'text-[#92400E]' : 'text-[#1B4332]'
                )}>
                  {formatCurrency(report.downPayment.unexplainedDeposits)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Days of History</p>
              <p className="font-mono text-sm font-medium text-[#1A1916]">
                {report.downPayment.daysOfHistory}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B6860]">Gift Letter Required</p>
              <div className="flex items-center gap-1 mt-0.5">
                <VerifyIcon status={report.downPayment.giftLetterRequired ? 'REVIEW' : 'PASS'} />
                <span className="text-sm font-medium">
                  {report.downPayment.giftLetterRequired ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        {report.liabilities.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-[#1A1916] mb-3">Liabilities</p>
            <div className="space-y-1">
              {report.liabilities.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-[#E8E6E1] pb-1.5 last:border-0">
                  <span className="text-[#6B6860]">{l.description}</span>
                  <span className="font-mono text-[#1A1916]">{formatCurrency(l.monthly)}/mo</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section D — Ratios */}
      <div className="card p-6">
        <h2 className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-4">D — Qualifying Ratios</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Qualifying Rate', value: report.ratios.qualifyingRate, limit: null, suffix: '%', isRate: true },
            { label: 'GDS', value: report.ratios.gds, limit: 39, suffix: '%', isRate: false },
            { label: 'TDS', value: report.ratios.tds, limit: 44, suffix: '%', isRate: false },
            { label: 'LTV', value: report.ratios.ltv, limit: 80, suffix: '%', isRate: false },
          ].map(({ label, value, limit, suffix, isRate }) => (
            <div key={label} className="bg-[#F7F6F3] rounded-xl p-4">
              <p className="text-xs text-[#6B6860] mb-1">{label}</p>
              <p className={cn('font-mono text-2xl font-bold',
                isRate
                  ? 'text-[#1A1916]'
                  : limit !== null && value !== null
                    ? ratioColor(value, limit)
                    : 'text-[#6B6860]'
              )}>
                {value !== null ? `${value.toFixed(1)}${suffix}` : '—'}
              </p>
              {limit !== null && value !== null && (
                <div className="flex items-center gap-1 mt-1">
                  {value <= limit ? (
                    <CheckCircle size={11} className="text-[#1B4332]" />
                  ) : (
                    <XCircle size={11} className="text-[#991B1B]" />
                  )}
                  <span className="text-[10px] text-[#6B6860]">Limit: {limit}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section E — What's Missing */}
      {report.missingItems.length > 0 && (
        <div className="card p-6">
          <h2 className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-4">E — What's Missing</h2>
          <div className="space-y-2">
            {report.missingItems.map((item, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm',
                  item.severity === 'REQUIRED'
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : 'bg-[#F7F6F3] text-[#6B6860]'
                )}
              >
                {item.severity === 'REQUIRED' ? (
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <Info size={13} className="mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <span className="font-medium text-xs uppercase mr-1.5">{item.severity}</span>
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section F — AI Advisory */}
      <div className="border border-[#1B4332] rounded-xl p-6 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-[#1B4332]" />
          <h2 className="text-sm font-semibold text-[#1B4332]">F — AI Advisory</h2>
        </div>
        <div className="text-sm text-[#1A1916] whitespace-pre-line leading-relaxed">
          {report.aiAdvisory}
        </div>
        {report.recommendedLenders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#E8E6E1]">
            <p className="text-xs font-medium text-[#6B6860] mb-2">Recommended Lender Tier</p>
            <div className="flex flex-wrap gap-2">
              {report.recommendedLenders.map((l, i) => (
                <span key={i} className="text-xs bg-[#D1FAE5] text-[#1B4332] px-2.5 py-1 rounded-full font-medium">
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
