import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles, Loader2, Shield, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, Info, ChevronRight, Lightbulb,
  Building2, AlertOctagon, Zap, Target, RefreshCw, Clock,
} from 'lucide-react';
import { aiApi } from '../../lib/api';
import { cn } from '../../lib/utils';
import { formatDate } from '../../lib/utils';
import type { Application } from '../../types';
import type { DealIntelligence, LenderMatch, RiskFlag } from '../../types';

// ── Score ring ──────────────────────────────────────────────────────────────
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color =
    score >= 85 ? '#22c55e' :
    score >= 70 ? '#3b82f6' :
    score >= 55 ? '#f59e0b' :
    score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white">{score}</span>
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
    POSSIBLE: 'bg-[#D1FAE5] border-[#1B4332] text-[#1B4332]',
    UNLIKELY: 'bg-red-50 border-red-200 text-red-600',
  }[match.verdict];

  const barColor = match.fitScore >= 70 ? 'bg-green-500' : match.fitScore >= 50 ? 'bg-[#1B4332]' : 'bg-red-400';
  const tierColor = match.tier === 'A' ? 'bg-emerald-100 text-emerald-700' : match.tier === 'B' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700';

  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full text-left bg-white rounded-xl border border-[#E8E6E1] p-4 hover:border-[#1B4332] hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#F7F6F3] flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-[#6B6860]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#1A1916] truncate">{match.lender}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn('px-1.5 py-0.5 rounded text-xs font-semibold', tierColor)}>{match.tier}</span>
              <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold border', verdictStyle)}>
                {match.verdict}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-[#F7F6F3] overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${match.fitScore}%` }} />
            </div>
            <span className="text-xs font-bold text-[#1A1916] flex-shrink-0">{match.fitScore}%</span>
          </div>
        </div>
        <ChevronRight size={14} className={cn('text-[#6B6860] transition-transform flex-shrink-0', open && 'rotate-90')} />
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-[#E8E6E1] space-y-2 text-left">
          {match.reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-[#1A1916]">{r}</span>
            </div>
          ))}
          {match.concerns.map((c, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-[#1A1916]">{c}</span>
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
    LOW: { bg: 'bg-[#D1FAE5] border-[#1B4332]', icon: <Info size={14} className="text-[#1B4332]" />, text: 'text-[#1B4332]', badge: 'bg-[#D1FAE5] text-[#1B4332]' },
    INFO: { bg: 'bg-[#F7F6F3] border-[#E8E6E1]', icon: <Info size={14} className="text-[#6B6860]" />, text: 'text-[#6B6860]', badge: 'bg-[#F7F6F3] text-[#6B6860]' },
  }[flag.severity];

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 rounded-xl border', styles.bg)}>
      <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <span className={cn('text-xs font-semibold', styles.text)}>{flag.message}</span>
        <div className="mt-1">
          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', styles.badge)}>{flag.category}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
interface Props {
  application: Application;
}

export default function AIAnalysisTab({ application }: Props) {
  const [intel, setIntel] = useState<DealIntelligence | null>(
    application.dealIntelligence ?? null
  );

  const analyzeMutation = useMutation({
    mutationFn: () => aiApi.reviewFile(application.id),
    onSuccess: (data) => setIntel(data),
  });

  const recColor =
    intel?.recommendation === 'APPROVE' ? 'text-green-400 bg-green-500/20 border-green-500/30' :
    intel?.recommendation === 'DECLINE' ? 'text-red-400 bg-red-500/20 border-red-500/30' :
    'text-amber-400 bg-amber-500/20 border-amber-500/30';

  const hasData = application.borrowers.length > 0 || application.property || application.mortgageTerms;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!intel) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#1B4332] to-[#065F46] flex items-center justify-center shadow-xl">
          <Sparkles size={36} className="text-white" />
        </div>
        <div className="text-center max-w-sm">
          <h3 className="text-xl font-bold text-[#1A1916]">AI Deal Intelligence</h3>
          <p className="text-sm text-[#6B6860] mt-2">
            Instant deal score, Canadian lender match analysis, risk flags, and broker coaching from a senior underwriter AI.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
          {[
            { icon: <Target size={16} />, label: 'Deal Score' },
            { icon: <Building2 size={16} />, label: 'Lender Match' },
            { icon: <Shield size={16} />, label: 'Risk Flags' },
            { icon: <Lightbulb size={16} />, label: 'Deal Coaching' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2 p-3 bg-[#F7F6F3] rounded-xl border border-[#E8E6E1]">
              <div className="text-[#1B4332]">{f.icon}</div>
              <span className="text-xs font-medium text-[#6B6860]">{f.label}</span>
            </div>
          ))}
        </div>

        {!hasData && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-sm text-center">
            <p className="text-xs text-amber-700 font-medium">Add borrower, property, and mortgage terms first for the most accurate analysis.</p>
          </div>
        )}

        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#1B4332] text-white font-semibold shadow-lg hover:shadow-xl hover:opacity-95 transition-all disabled:opacity-60"
        >
          {analyzeMutation.isPending ? (
            <><Loader2 size={18} className="animate-spin" /> Analyzing with AI…</>
          ) : (
            <><Sparkles size={18} /> Run AI Analysis</>
          )}
        </button>

        {analyzeMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-sm text-center">
            <p className="text-sm text-red-600 font-medium">Analysis failed.</p>
            <p className="text-xs text-red-500 mt-1">Check that ANTHROPIC_API_KEY is set in Railway environment variables.</p>
          </div>
        )}
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Hero score card */}
      <div className="bg-gradient-to-br from-[#1A1916] to-[#2D2B26] rounded-xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <ScoreRing score={intel.dealScore} grade={intel.grade} />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl font-bold">{intel.headline}</h3>
              <span className={cn('px-3 py-1 rounded-full text-xs font-bold border', recColor)}>
                {intel.recommendation.replace('_', ' ')}
              </span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed">{intel.summary}</p>
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
        {application.dealAnalyzedAt && (
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-white/10">
            <Clock size={11} className="text-white/40" />
            <span className="text-xs text-white/40">Last analyzed {formatDate(application.dealAnalyzedAt)}</span>
          </div>
        )}
      </div>

      {/* Ratio commentary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'GDS Analysis', comment: intel.gdsComment, icon: <TrendingUp size={14} /> },
          { label: 'TDS Analysis', comment: intel.tdsComment, icon: <TrendingUp size={14} /> },
          { label: 'LTV Analysis', comment: intel.ltvComment, icon: <Shield size={14} /> },
        ].map((r) => (
          <div key={r.label} className="bg-white rounded-xl border border-[#E8E6E1] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#1B4332]">{r.icon}</span>
              <span className="text-xs font-semibold text-[#1A1916]">{r.label}</span>
            </div>
            <p className="text-xs text-[#6B6860] leading-relaxed">{r.comment}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lender matches */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#1A1916] flex items-center gap-2">
            <Building2 size={15} className="text-[#1B4332]" /> Lender Match
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
              <h4 className="text-sm font-bold text-[#1A1916] flex items-center gap-2">
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
              <h4 className="text-sm font-bold text-[#1A1916] flex items-center gap-2">
                <CheckCircle size={15} className="text-[#1B4332]" /> Conditions
              </h4>
              <div className="bg-white rounded-xl border border-[#E8E6E1] divide-y divide-[#E8E6E1]">
                {intel.conditions.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className="w-5 h-5 rounded-full bg-[#D1FAE5] text-[#1B4332] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-xs text-[#1A1916] leading-relaxed">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deal coaching */}
          {intel.dealCoaching.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-[#1A1916] flex items-center gap-2">
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

      {/* Re-run */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#6B6860] hover:text-[#1B4332] hover:bg-[#D1FAE5] transition-all border border-[#E8E6E1] hover:border-[#1B4332] disabled:opacity-50"
        >
          {analyzeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {analyzeMutation.isPending ? 'Re-analyzing…' : 'Re-run Analysis'}
        </button>
      </div>
    </div>
  );
}
