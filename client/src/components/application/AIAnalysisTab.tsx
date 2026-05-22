import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles, Loader2, Shield, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Info, ChevronRight, Lightbulb,
  Building2, AlertOctagon, Zap, Target,
} from 'lucide-react';
import { aiApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { Application } from '../../types';
import type { DealIntelligence, LenderMatch, RiskFlag } from '../../types';

// ── Score ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80 ? '#22c55e' :
    score >= 65 ? '#3b82f6' :
    score >= 50 ? '#f59e0b' :
    score >= 35 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-slate-900">{score}</span>
        <span className="text-sm font-bold" style={{ color }}>{grade}</span>
      </div>
    </div>
  );
}

// ── Lender card ─────────────────────────────────────────────────────────────
function LenderCard({ match }: { match: LenderMatch }) {
  const [open, setOpen] = useState(false);
  const verdictStyle = {
    STRONG: 'bg-green-50 border-green-200 text-green-700',
    POSSIBLE: 'bg-blue-50 border-blue-200 text-blue-700',
    UNLIKELY: 'bg-red-50 border-red-200 text-red-600',
  }[match.verdict];

  const barColor = match.fitScore >= 70 ? 'bg-green-500' : match.fitScore >= 50 ? 'bg-blue-500' : 'bg-red-400';

  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800 truncate">{match.lender}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0', verdictStyle)}>
              {match.verdict}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${match.fitScore}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600 flex-shrink-0">{match.fitScore}%</span>
            <span className="text-xs text-slate-400 flex-shrink-0">{match.tier} Lender</span>
          </div>
        </div>
        <ChevronRight size={14} className={cn('text-slate-400 transition-transform flex-shrink-0', open && 'rotate-90')} />
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-left">
          {match.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-slate-600">{r}</span>
            </div>
          ))}
          {match.concerns.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-slate-600">{c}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// ── Risk flag ───────────────────────────────────────────────────────────────
function RiskFlagRow({ flag }: { flag: RiskFlag }) {
  const styles = {
    HIGH: { bg: 'bg-red-50 border-red-200', icon: <XCircle size={14} className="text-red-500" />, text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
    MEDIUM: { bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle size={14} className="text-amber-500" />, text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
    LOW: { bg: 'bg-blue-50 border-blue-200', icon: <Info size={14} className="text-blue-500" />, text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
    INFO: { bg: 'bg-slate-50 border-slate-200', icon: <Info size={14} className="text-slate-400" />, text: 'text-slate-600', badge: 'bg-slate-100 text-slate-500' },
  }[flag.severity];

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 rounded-xl border', styles.bg)}>
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-semibold', styles.text)}>{flag.message}</span>
        </div>
        <span className={cn('text-xs mt-0.5 inline-block px-1.5 py-0.5 rounded font-medium', styles.badge)}>{flag.category}</span>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
interface Props {
  application: Application;
}

export default function AIAnalysisTab({ application }: Props) {
  const [intel, setIntel] = useState<DealIntelligence | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: () => aiApi.reviewFile(application.id),
    onSuccess: (data) => setIntel(data),
  });

  const recColor =
    intel?.recommendation === 'APPROVE' ? 'text-green-600 bg-green-50 border-green-200' :
    intel?.recommendation === 'DECLINE' ? 'text-red-600 bg-red-50 border-red-200' :
    'text-amber-600 bg-amber-50 border-amber-200';

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!intel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-xl">
          <Sparkles size={36} className="text-white" />
        </div>
        <div className="text-center max-w-sm">
          <h3 className="text-xl font-bold text-slate-900">AI Deal Intelligence</h3>
          <p className="text-sm text-slate-500 mt-2">
            Get an instant deal score, lender match analysis, risk flags, and deal coaching from a senior underwriter AI.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
          {[
            { icon: <Target size={16} />, label: 'Deal Score' },
            { icon: <Building2 size={16} />, label: 'Lender Match' },
            { icon: <Shield size={16} />, label: 'Risk Flags' },
            { icon: <Lightbulb size={16} />, label: 'Deal Coaching' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-violet-500">{f.icon}</div>
              <span className="text-xs font-medium text-slate-600">{f.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl hover:opacity-95 transition-all disabled:opacity-60"
        >
          {analyzeMutation.isPending ? (
            <><Loader2 size={18} className="animate-spin" /> Analyzing deal…</>
          ) : (
            <><Sparkles size={18} /> Run AI Analysis</>
          )}
        </button>

        {analyzeMutation.isError && (
          <p className="text-sm text-red-500">Analysis failed. Make sure ANTHROPIC_API_KEY is set in Railway.</p>
        )}
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Hero score bar */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <ScoreRing score={intel.dealScore} grade={intel.grade} />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold">{intel.headline}</h3>
              <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', recColor)}>
                {intel.recommendation.replace('_', ' ')}
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{intel.summary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="flex items-start gap-2 bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
                <Zap size={13} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-green-300">{intel.strengthSummary}</span>
              </div>
              <div className="flex items-start gap-2 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
                <AlertOctagon size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-red-300">{intel.weaknessSummary}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ratio commentary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'GDS Analysis', comment: intel.gdsComment, icon: <TrendingUp size={14} /> },
          { label: 'TDS Analysis', comment: intel.tdsComment, icon: <TrendingUp size={14} /> },
          { label: 'LTV Analysis', comment: intel.ltvComment, icon: <Shield size={14} /> },
        ].map((r) => (
          <div key={r.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-violet-500">{r.icon}</span>
              <span className="text-xs font-semibold text-slate-700">{r.label}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{r.comment}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lender matches */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 size={15} className="text-violet-500" /> Lender Match
          </h4>
          <div className="space-y-2">
            {intel.lenderMatches
              .sort((a, b) => b.fitScore - a.fitScore)
              .map((m) => <LenderCard key={m.lender} match={m} />)}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Risk flags */}
          {intel.riskFlags.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" /> Risk Flags
              </h4>
              <div className="space-y-2">
                {intel.riskFlags
                  .sort((a, b) => ['HIGH','MEDIUM','LOW','INFO'].indexOf(a.severity) - ['HIGH','MEDIUM','LOW','INFO'].indexOf(b.severity))
                  .map((f, i) => <RiskFlagRow key={i} flag={f} />)}
              </div>
            </div>
          )}

          {/* Conditions */}
          {intel.conditions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle size={15} className="text-blue-500" /> Conditions
              </h4>
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {intel.conditions.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-xs text-slate-700 leading-relaxed">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deal coaching */}
          {intel.dealCoaching.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lightbulb size={15} className="text-yellow-500" /> Deal Coaching
              </h4>
              <div className="space-y-2">
                {intel.dealCoaching.map((tip, i) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-yellow-800">{tip.tip}</p>
                    <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                      <ChevronRight size={11} /> {tip.impact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fraud alerts */}
          {intel.fraudAlerts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-red-600 flex items-center gap-2">
                <AlertOctagon size={15} /> Fraud Alerts
              </h4>
              <div className="space-y-2">
                {intel.fraudAlerts.map((alert, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                    <AlertOctagon size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-red-700 font-medium">{alert}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Re-run button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => { setIntel(null); analyzeMutation.reset(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-all border border-slate-200 hover:border-violet-200"
        >
          <Sparkles size={13} /> Re-run Analysis
        </button>
      </div>
    </div>
  );
}
