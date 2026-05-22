import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, XCircle, AlertTriangle, Info, Sparkles,
  ChevronDown, ChevronRight, Download, Eye, EyeOff,
} from 'lucide-react';
import { intakeApi, apiClient } from '../lib/api';
import Spinner from '../components/ui/Spinner';
import StatusBadge from '../components/ui/StatusBadge';
import { formatCurrency, formatPercent, cn } from '../lib/utils';
import type { DealReviewReport, FraudSignal, ClassifiedDocument } from '../types';

// ---------------------------------------------------------------------------
// Types for tabs
// ---------------------------------------------------------------------------
type TabId = 'overview' | 'analysis' | 'documents' | 'fraud' | 'memo' | 'advisory';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Deal Overview' },
  { id: 'analysis', label: 'Underwriting Analysis' },
  { id: 'documents', label: 'Documents' },
  { id: 'fraud', label: 'Fraud Signals' },
  { id: 'memo', label: 'Credit Memo' },
  { id: 'advisory', label: 'AI Advisory' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function scoreColor(score: number): string {
  if (score >= 85) return 'text-[#1B4332]';
  if (score >= 65) return 'text-[#92400E]';
  return 'text-[#991B1B]';
}

function StatusIcon({ status }: { status: 'PASS' | 'FAIL' | 'MISSING' }) {
  if (status === 'PASS') return <CheckCircle size={14} className="text-[#1B4332]" />;
  if (status === 'MISSING') return <Info size={14} className="text-[#6B6860]" />;
  return <XCircle size={14} className="text-[#991B1B]" />;
}

// ---------------------------------------------------------------------------
// Document row (expandable)
// ---------------------------------------------------------------------------
function DocRow({ doc, isEven }: { doc: ClassifiedDocument; isEven: boolean }) {
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
        <td className="px-3 py-3 text-xs">
          <span className={cn('font-mono', doc.confidence >= 0.85 ? 'text-[#1B4332]' : doc.confidence >= 0.6 ? 'text-[#92400E]' : 'text-[#991B1B]')}>
            {(doc.confidence * 100).toFixed(0)}%
          </span>
        </td>
        <td className="px-3 py-3">
          {doc.issues.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#92400E]">
              <AlertTriangle size={11} /> {doc.issues.length} issue{doc.issues.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#1B4332]">
              <CheckCircle size={11} /> Clear
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className={isEven ? 'bg-white' : 'bg-[#F7F6F3]'}>
          <td colSpan={5} className="px-5 pb-4 pt-1">
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
// Fraud signal card
// ---------------------------------------------------------------------------
function FraudSignalCard({
  signal,
  onAcknowledge,
}: {
  signal: FraudSignal;
  onAcknowledge: (id: string) => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      signal.severity === 'HIGH'
        ? 'border-[#991B1B] bg-[#FEE2E2]'
        : signal.severity === 'MEDIUM'
          ? 'border-[#92400E]/40 bg-[#FEF3C7]'
          : 'border-[#E8E6E1] bg-[#F7F6F3]'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'text-xs font-semibold uppercase px-2 py-0.5 rounded',
              signal.severity === 'HIGH' ? 'bg-[#991B1B] text-white' :
              signal.severity === 'MEDIUM' ? 'bg-[#92400E] text-white' :
              'bg-[#6B6860] text-white'
            )}>
              {signal.severity}
            </span>
            <span className="text-sm font-medium text-[#1A1916]">{signal.type}</span>
          </div>
          <p className="text-xs text-[#6B6860]">{signal.recommendation}</p>
        </div>
        {signal.acknowledged && (
          <span className="text-xs bg-[#D1FAE5] text-[#1B4332] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
            Acknowledged
          </span>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowEvidence((v) => !v)}
          className="flex items-center gap-1 text-xs text-[#6B6860] hover:text-[#1A1916]"
        >
          {showEvidence ? <EyeOff size={11} /> : <Eye size={11} />}
          {showEvidence ? 'Hide' : 'Show'} evidence
        </button>
        {showEvidence && (
          <div className="mt-2 space-y-2 text-xs">
            <div className="bg-white rounded-lg border border-[#E8E6E1] p-3">
              <p className="font-medium text-[#1A1916] mb-1">Evidence:</p>
              <p className="text-[#6B6860]">{signal.evidence}</p>
            </div>
            <div className="bg-white rounded-lg border border-[#E8E6E1] p-3">
              <p className="font-medium text-[#1A1916] mb-1">AI Explanation:</p>
              <p className="text-[#6B6860]">{signal.aiExplanation}</p>
            </div>
          </div>
        )}
      </div>

      {!signal.acknowledged && (
        <button
          onClick={() => onAcknowledge(signal.id)}
          className="btn-primary text-xs"
        >
          Acknowledge
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab panels
// ---------------------------------------------------------------------------
function OverviewTab({ report }: { report: DealReviewReport }) {
  const eng = report.engineOutput;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'GDS', value: formatPercent(eng.gds), limit: '39%', pass: eng.gds <= 39 },
          { label: 'TDS', value: formatPercent(eng.tds), limit: '44%', pass: eng.tds <= 44 },
          { label: 'LTV', value: formatPercent(eng.ltv), limit: '80%', pass: eng.ltv <= 80 },
          { label: 'Stress GDS', value: formatPercent(eng.stressGds), limit: '39%', pass: eng.stressGds <= 39 },
          { label: 'Stress TDS', value: formatPercent(eng.stressTds), limit: '44%', pass: eng.stressTds <= 44 },
          { label: 'Qualifying Rate', value: `${eng.qualifyingRate.toFixed(2)}%`, limit: null, pass: true },
        ].map(({ label, value, limit, pass }) => (
          <div key={label} className="bg-[#F7F6F3] rounded-xl p-4">
            <p className="text-xs text-[#6B6860] mb-1">{label}</p>
            <p className={cn('font-mono text-2xl font-bold', pass ? 'text-[#1B4332]' : 'text-[#991B1B]')}>
              {value}
            </p>
            {limit && (
              <div className="flex items-center gap-1 mt-1">
                {pass ? <CheckCircle size={10} className="text-[#1B4332]" /> : <XCircle size={10} className="text-[#991B1B]" />}
                <span className="text-[10px] text-[#6B6860]">Limit: {limit}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {eng.cmhcRequired && (
        <div className="rounded-xl border border-[#E8E6E1] p-4 bg-[#FEF3C7]">
          <p className="text-xs font-semibold text-[#92400E] mb-1">CMHC Insurance Required</p>
          <p className="text-sm font-mono text-[#92400E]">Premium: {formatCurrency(eng.cmhcPremium)}</p>
        </div>
      )}

      {eng.flags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide">Underwriting Flags</p>
          {eng.flags.map((flag, i) => (
            <div key={i} className={cn(
              'flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm',
              flag.type === 'FAIL' ? 'bg-[#FEE2E2] text-[#991B1B]' :
              flag.type === 'WARN' ? 'bg-[#FEF3C7] text-[#92400E]' :
              flag.type === 'PASS' ? 'bg-[#D1FAE5] text-[#1B4332]' :
              'bg-[#F7F6F3] text-[#6B6860]'
            )}>
              {flag.type === 'FAIL' ? <XCircle size={13} className="mt-0.5 flex-shrink-0" /> :
               flag.type === 'WARN' ? <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> :
               flag.type === 'PASS' ? <CheckCircle size={13} className="mt-0.5 flex-shrink-0" /> :
               <Info size={13} className="mt-0.5 flex-shrink-0" />}
              {flag.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AnalysisTab({ report }: { report: DealReviewReport }) {
  const dp = report.downPaymentVerification;
  return (
    <div className="space-y-6">
      {/* Income Verification */}
      <div>
        <p className="text-sm font-semibold text-[#1A1916] mb-3">Income Verification</p>
        <div className="divide-y divide-[#E8E6E1] border border-[#E8E6E1] rounded-xl overflow-hidden">
          {report.incomeVerification.map((item, i) => (
            <div key={i} className={cn('flex items-center justify-between px-4 py-3', i % 2 === 0 ? 'bg-white' : 'bg-[#F7F6F3]')}>
              <span className="text-sm text-[#6B6860]">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#1A1916]">{item.value}</span>
                <StatusIcon status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Down Payment */}
      <div>
        <p className="text-sm font-semibold text-[#1A1916] mb-3">Down Payment Verification</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Submitted', value: dp.totalSubmitted },
            { label: 'Sourced', value: dp.sourced },
            { label: 'Unexplained', value: dp.unexplained, warn: dp.unexplained > 0 },
            { label: 'Required', value: dp.required },
          ].map(({ label, value, warn }) => (
            <div key={label} className={cn('rounded-xl p-4', warn ? 'bg-[#FEF3C7]' : 'bg-[#F7F6F3]')}>
              <p className="text-xs text-[#6B6860] mb-1">{label}</p>
              <p className={cn('font-mono text-lg font-semibold', warn ? 'text-[#92400E]' : 'text-[#1A1916]')}>
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ report }: { report: DealReviewReport }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#E8E6E1] bg-[#F7F6F3]">
            <th className="text-left px-5 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Document</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Type</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Key Data</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Confidence</th>
            <th className="text-left px-3 py-2.5 text-xs font-medium text-[#6B6860] uppercase tracking-wide">Signals</th>
          </tr>
        </thead>
        <tbody>
          {report.documents.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#6B6860]">No documents</td>
            </tr>
          ) : (
            report.documents.map((doc, i) => (
              <DocRow key={doc.filename + i} doc={doc} isEven={i % 2 === 0} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function FraudTab({ report, onAcknowledge }: { report: DealReviewReport; onAcknowledge: (id: string) => void }) {
  const high = report.fraudSignals.filter((s) => s.severity === 'HIGH');
  const medium = report.fraudSignals.filter((s) => s.severity === 'MEDIUM');
  const low = report.fraudSignals.filter((s) => s.severity === 'LOW');

  if (report.fraudSignals.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle size={32} className="text-[#1B4332] mx-auto mb-3" />
        <p className="text-sm font-medium text-[#1A1916]">No fraud signals detected</p>
        <p className="text-xs text-[#6B6860] mt-1">All documents passed fraud screening</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {high.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#991B1B] uppercase tracking-wide">High Severity</p>
          {high.map((s) => <FraudSignalCard key={s.id} signal={s} onAcknowledge={onAcknowledge} />)}
        </div>
      )}
      {medium.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#92400E] uppercase tracking-wide">Medium Severity</p>
          {medium.map((s) => <FraudSignalCard key={s.id} signal={s} onAcknowledge={onAcknowledge} />)}
        </div>
      )}
      {low.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide">Low Severity</p>
          {low.map((s) => <FraudSignalCard key={s.id} signal={s} onAcknowledge={onAcknowledge} />)}
        </div>
      )}
    </div>
  );
}

function MemoTab({ report }: { report: DealReviewReport }) {
  const printMemo = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Credit Memo</title>
      <style>body{font-family:system-ui,sans-serif;margin:40px;}</style>
      </head><body>${report.creditMemoHtml}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={printMemo} className="btn-primary inline-flex items-center gap-2 text-xs">
          <Download size={12} /> Download PDF
        </button>
      </div>
      <div
        className="rounded-xl border border-[#E8E6E1] bg-white p-6 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: report.creditMemoHtml }}
      />
    </div>
  );
}

function AdvisoryTab({ report }: { report: DealReviewReport }) {
  return (
    <div className="space-y-4">
      <div className="border border-[#1B4332] rounded-xl p-5 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} className="text-[#1B4332]" />
          <p className="text-sm font-semibold text-[#1B4332]">AI Advisory</p>
        </div>
        <p className="text-sm text-[#1A1916] whitespace-pre-line leading-relaxed">{report.aiAdvisory}</p>
      </div>

      <div className="card p-5">
        <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-3">Recommended Decision</p>
        <span className={cn(
          'inline-block px-3 py-1.5 rounded-lg text-sm font-semibold',
          report.recommendedDecision === 'APPROVE' ? 'bg-[#D1FAE5] text-[#1B4332]' :
          report.recommendedDecision === 'DECLINE' ? 'bg-[#FEE2E2] text-[#991B1B]' :
          'bg-[#FEF3C7] text-[#92400E]'
        )}>
          {report.recommendedDecision === 'APPROVE' ? 'Approve' :
           report.recommendedDecision === 'DECLINE' ? 'Decline' : 'Manual Review'}
        </span>
      </div>

      {report.recommendedConditions.length > 0 && (
        <div className="card p-5">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-3">Conditions to Clear</p>
          <ul className="space-y-2">
            {report.recommendedConditions.map((cond, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#1A1916]">
                <AlertTriangle size={13} className="text-[#92400E] mt-0.5 flex-shrink-0" />
                {cond}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DealReviewDashboard() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [localSignals, setLocalSignals] = useState<Record<string, boolean>>({});

  const { data: report, isLoading, error } = useQuery<DealReviewReport>({
    queryKey: ['deal-review', id],
    queryFn: () => intakeApi.getDealReview(id!),
    enabled: !!id,
    retry: (_, err: unknown) => {
      const status = (err as { response?: { status: number } })?.response?.status;
      return status !== 404;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/applications/${id}/deal-review`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-review', id] }),
  });

  const handleAcknowledge = (signalId: string) => {
    setLocalSignals((prev) => ({ ...prev, [signalId]: true }));
    apiClient.patch(`/applications/${id}/fraud-signals/${signalId}/acknowledge`).catch(() => {});
  };

  const is404 = !report && !isLoading && (error as { response?: { status: number } })?.response?.status === 404;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (is404 || (!report && !isLoading)) {
    return (
      <div className="max-w-xl mx-auto card p-8 text-center space-y-4 mt-8">
        <div className="w-12 h-12 rounded-2xl bg-[#D1FAE5] flex items-center justify-center mx-auto">
          <Sparkles size={22} className="text-[#1B4332]" />
        </div>
        <h2 className="text-lg font-semibold text-[#1A1916]">Deal Analysis Not Yet Run</h2>
        <p className="text-sm text-[#6B6860]">
          No deal review found for this application. Run the full deal analysis to proceed.
        </p>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="btn-primary inline-flex items-center gap-2"
        >
          {generateMutation.isPending ? (
            <><Spinner size="sm" />Running analysis...</>
          ) : (
            <><Sparkles size={14} />Run Deal Analysis</>
          )}
        </button>
        {generateMutation.isError && (
          <p className="text-xs text-[#991B1B]">Analysis failed. Please try again.</p>
        )}
      </div>
    );
  }

  if (!report) return null;

  // Merge local acknowledgements
  const enrichedReport: DealReviewReport = {
    ...report,
    fraudSignals: report.fraudSignals.map((s) => ({
      ...s,
      acknowledged: s.acknowledged || !!localSignals[s.id],
    })),
  };

  const totalScore = enrichedReport.dealQualityScore.total;

  return (
    <div className="flex gap-6 items-start">
      {/* Left sticky column */}
      <div className="hidden lg:flex flex-col w-60 flex-shrink-0 sticky top-6 space-y-4">
        {/* Deal Quality Score */}
        <div className="card p-5">
          <p className="text-xs text-[#6B6860] mb-2">Deal Quality Score</p>
          <p className={cn('font-mono text-5xl font-bold', scoreColor(totalScore))}>
            {totalScore}
          </p>
          <p className="text-xs text-[#6B6860] mt-1">/100</p>

          <div className="mt-3 pt-3 border-t border-[#E8E6E1]">
            <p className="text-xs text-[#6B6860] mb-1">Risk Level</p>
            <span className={cn(
              'inline-block px-2.5 py-1 rounded-full text-xs font-semibold',
              enrichedReport.riskLevel === 'LOW' ? 'bg-[#D1FAE5] text-[#1B4332]' :
              enrichedReport.riskLevel === 'MEDIUM' ? 'bg-[#FEF3C7] text-[#92400E]' :
              'bg-[#FEE2E2] text-[#991B1B]'
            )}>
              {enrichedReport.riskLevel}
            </span>
          </div>
        </div>

        {/* Decision buttons */}
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-3">Decision</p>
          <button className="w-full btn-primary border-[#1B4332] text-[#1B4332] hover:bg-[#D1FAE5] font-semibold">
            APPROVE
          </button>
          <button className="w-full btn-danger font-semibold">
            DECLINE
          </button>
          <button className="w-full bg-white border border-[#E8E6E1] text-[#6B6860] rounded-lg py-2 px-4 text-sm font-medium hover:bg-[#F7F6F3] transition-colors">
            CONDITIONS
          </button>
        </div>

        {/* Score breakdown */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wide mb-3">Score Breakdown</p>
          <div className="space-y-2 text-xs">
            {[
              ['Ratio Health', enrichedReport.dealQualityScore.ratioHealth, 30],
              ['Doc Completeness', enrichedReport.dealQualityScore.documentCompleteness, 25],
              ['Income Verification', enrichedReport.dealQualityScore.incomeVerification, 20],
              ['Down Payment', enrichedReport.dealQualityScore.downPaymentSourcing, 15],
              ['Fraud Signal Clean', enrichedReport.dealQualityScore.fraudSignalClean, 10],
            ].map(([label, val, max]) => (
              <div key={label as string} className="flex justify-between">
                <span className="text-[#6B6860]">{label as string}</span>
                <span className="font-mono font-medium text-[#1A1916]">{val as number}/{max as number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fraud signal count */}
        {enrichedReport.fraudSignals.length > 0 && (
          <div className={cn(
            'rounded-xl border p-4',
            enrichedReport.fraudSignals.some((s) => s.severity === 'HIGH' && !s.acknowledged)
              ? 'border-[#991B1B] bg-[#FEE2E2]'
              : 'border-[#E8E6E1] bg-[#F7F6F3]'
          )}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className={
                enrichedReport.fraudSignals.some((s) => s.severity === 'HIGH' && !s.acknowledged)
                  ? 'text-[#991B1B]'
                  : 'text-[#92400E]'
              } />
              <span className="text-xs font-medium text-[#1A1916]">
                {enrichedReport.fraudSignals.filter((s) => !s.acknowledged).length} unacknowledged signal{enrichedReport.fraudSignals.filter((s) => !s.acknowledged).length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold text-[#1A1916]">Deal Review</h1>
          <p className="text-sm text-[#6B6860] mt-0.5">Underwriter analysis dashboard</p>
        </div>

        {/* Mobile decision + score */}
        <div className="lg:hidden card p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-[#6B6860]">Deal Quality Score</p>
              <p className={cn('font-mono text-3xl font-bold', scoreColor(totalScore))}>
                {totalScore}
              </p>
            </div>
            <span className={cn(
              'inline-block px-2.5 py-1 rounded-full text-xs font-semibold',
              enrichedReport.riskLevel === 'LOW' ? 'bg-[#D1FAE5] text-[#1B4332]' :
              enrichedReport.riskLevel === 'MEDIUM' ? 'bg-[#FEF3C7] text-[#92400E]' :
              'bg-[#FEE2E2] text-[#991B1B]'
            )}>
              {enrichedReport.riskLevel} RISK
            </span>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 btn-primary text-xs font-semibold py-2">APPROVE</button>
            <button className="flex-1 btn-danger text-xs font-semibold py-2">DECLINE</button>
            <button className="flex-1 bg-white border border-[#E8E6E1] text-[#6B6860] rounded-lg py-2 px-3 text-xs font-medium">CONDITIONS</button>
          </div>
        </div>

        {/* Tabbed panel */}
        <div className="card overflow-hidden">
          {/* Tab bar */}
          <div className="flex overflow-x-auto border-b border-[#E8E6E1] bg-white scrollbar-thin">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0',
                  activeTab === tab.id
                    ? 'border-[#1B4332] text-[#1B4332]'
                    : 'border-transparent text-[#6B6860] hover:text-[#1A1916]'
                )}
              >
                {tab.label}
                {tab.id === 'fraud' && enrichedReport.fraudSignals.filter((s) => !s.acknowledged).length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#991B1B] text-white text-[9px] font-bold">
                    {enrichedReport.fraudSignals.filter((s) => !s.acknowledged).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'overview' && <OverviewTab report={enrichedReport} />}
            {activeTab === 'analysis' && <AnalysisTab report={enrichedReport} />}
            {activeTab === 'documents' && <DocumentsTab report={enrichedReport} />}
            {activeTab === 'fraud' && <FraudTab report={enrichedReport} onAcknowledge={handleAcknowledge} />}
            {activeTab === 'memo' && <MemoTab report={enrichedReport} />}
            {activeTab === 'advisory' && <AdvisoryTab report={enrichedReport} />}
          </div>
        </div>
      </div>
    </div>
  );
}
