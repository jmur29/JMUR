import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  FileText, Upload, Sparkles, ChevronRight, X,
  CheckCircle, AlertCircle, Loader2, File,
} from 'lucide-react';
import { applicationsApi, borrowersApi, propertyApi, termsApi, aiApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { ParsedApplication } from '../types';

// ── Submission note zone ────────────────────────────────────────────────────
function SubmissionNoteZone({ text, onChange, files, onFiles }: {
  text: string;
  onChange: (v: string) => void;
  files: File[];
  onFiles: (f: File[]) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    multiple: false,
    onDrop: (accepted) => onFiles(accepted),
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
          <FileText size={14} className="text-violet-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Submission Note</p>
          <p className="text-xs text-slate-500">Paste or upload the broker's deal summary</p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Paste broker submission note here…\n\ne.g. Borrower: John Smith, DOB 1985-03-12, employed at Acme Corp, $95,000/yr base salary, credit score 740, purchasing 123 Main St Toronto for $850,000 with $170,000 down, 25yr amort, 5yr term at 5.49%...`}
        className="flex-1 min-h-[180px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
      />

      <div
        {...getRootProps()}
        className={cn(
          'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm',
          isDragActive
            ? 'border-violet-400 bg-violet-50 text-violet-600'
            : 'border-slate-200 text-slate-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/50'
        )}
      >
        <input {...getInputProps()} />
        <Upload size={14} />
        {files.length > 0
          ? <span className="text-violet-600 font-medium">{files[0].name}</span>
          : <span>Or drop a PDF submission note</span>}
      </div>
    </div>
  );
}

// ── Income docs zone ────────────────────────────────────────────────────────
function IncomeDocsZone({ files, onFiles }: {
  files: File[];
  onFiles: (updater: (prev: File[]) => File[]) => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    multiple: true,
    onDrop: (accepted) => onFiles((prev) => [...prev, ...accepted]),
  });

  const remove = useCallback((name: string) => {
    onFiles((prev) => prev.filter((f) => f.name !== name));
  }, [onFiles]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
          <Upload size={14} className="text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Income & Supporting Docs</p>
          <p className="text-xs text-slate-500">T4s, NOAs, paystubs, bank statements</p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all px-4 py-10',
          isDragActive
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Upload size={18} className="text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">Drop files here</p>
          <p className="text-xs text-slate-400 mt-0.5">PDF, JPG, PNG supported</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {['T4', 'NOA', 'Paystub', 'Bank Statement', 'Employment Letter'].map((t) => (
          <span key={t} className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-500 font-medium">
            {t}
          </span>
        ))}
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {files.map((f) => (
            <div key={f.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
              <File size={13} className="text-blue-500 flex-shrink-0" />
              <span className="text-xs text-slate-700 truncate flex-1">{f.name}</span>
              <button onClick={() => remove(f.name)} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Review field ────────────────────────────────────────────────────────────
function ReviewField({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800">{String(value)}</span>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
type Stage = 'intake' | 'processing' | 'review';

export default function NewApplication() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('intake');
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [incomeFiles, setIncomeFiles] = useState<File[]>([]);
  const [parsed, setParsed] = useState<ParsedApplication | null>(null);

  const hasInput = submissionText.trim().length > 20 || submissionFiles.length > 0 || incomeFiles.length > 0;

  const parseMutation = useMutation({
    mutationFn: () => {
      const text = submissionText.trim() || `Documents provided: ${incomeFiles.map((f) => f.name).join(', ')}`;
      return aiApi.parseSubmission(text);
    },
    onSuccess: (data) => {
      setParsed(data);
      setStage('review');
    },
    onError: () => {
      toast.error('AI parsing failed — you can fill in details manually');
      setParsed(null);
      setStage('review');
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const p = parsed;
      const app = await applicationsApi.create({});

      await borrowersApi.create(app.id, {
        type: 'PRIMARY',
        firstName: p?.firstName ?? '',
        lastName: p?.lastName ?? '',
        dob: p?.dob ?? '1990-01-01',
        email: p?.email ?? '',
        phone: p?.phone ?? '',
        sin: '',
        employmentType: p?.employmentType ?? 'EMPLOYED',
        creditScore: p?.creditScore ?? 700,
        bankruptcies: false,
        collections: false,
        existingMortgages: 0,
      });

      if (p?.address) {
        await propertyApi.create(app.id, {
          address: p.address,
          city: p.city ?? '',
          province: p.province ?? 'ON',
          postalCode: p.postalCode ?? '',
          propertyType: p.propertyType ?? 'DETACHED',
          occupancy: 'OWNER',
          purchasePrice: p.purchasePrice ?? 0,
          downPayment: p.downPayment ?? 0,
          appraisedValue: p.purchasePrice ?? 0,
          annualTax: 0,
          monthlyHeat: 150,
          condoFees: 0,
        });
      }

      if (p?.contractRate) {
        await termsApi.create(app.id, {
          contractRate: p.contractRate,
          amortizationYears: p.amortizationYears ?? 25,
          termYears: p.termYears ?? 5,
          insured: false,
          stressRate: Math.max(p.contractRate + 2, 5.25),
          monthlyPayment: 0,
          mortgageAmount: 0,
        });
      }

      return app;
    },
    onSuccess: (app) => {
      toast.success('Application created — review and run underwriting');
      navigate(`/applications/${app.id}`);
    },
    onError: () => toast.error('Failed to create application'),
  });

  // ── Intake ──────────────────────────────────────────────────────────────────
  if (stage === 'intake') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Submission</h1>
          <p className="text-sm text-slate-500 mt-1">
            Drop in a submission note and income docs — ClearPath AI extracts everything automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <SubmissionNoteZone
              text={submissionText}
              onChange={setSubmissionText}
              files={submissionFiles}
              onFiles={setSubmissionFiles}
            />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <IncomeDocsZone files={incomeFiles} onFiles={setIncomeFiles} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => { setParsed(null); setStage('review'); }}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Skip — fill in manually
          </button>
          <button
            onClick={() => { setStage('processing'); parseMutation.mutate(); }}
            disabled={!hasInput}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all',
              hasInput
                ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md hover:shadow-lg hover:opacity-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            <Sparkles size={16} />
            Analyze with ClearPath AI
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Processing ──────────────────────────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <div className="max-w-md mx-auto mt-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center mx-auto shadow-lg">
          <Loader2 size={28} className="text-white animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Analyzing submission…</h2>
          <p className="text-sm text-slate-500 mt-2">
            ClearPath AI is reading the documents and extracting borrower, income, and property details.
          </p>
        </div>
        <div className="space-y-2.5 text-left bg-slate-50 rounded-xl p-4">
          {['Reading submission note', 'Extracting borrower details', 'Identifying income sources', 'Parsing property information'].map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={12} className="animate-spin text-violet-500 flex-shrink-0" />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Review ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Extracted Data</h1>
          <p className="text-sm text-slate-500 mt-1">
            {parsed
              ? 'ClearPath AI extracted the following — review before creating the file.'
              : 'AI parsing skipped — the application will be created as a draft for manual entry.'}
          </p>
        </div>
        <button
          onClick={() => setStage('intake')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <X size={14} /> Start over
        </button>
      </div>

      {parsed ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={15} className="text-green-500" />
              <span className="text-sm font-semibold text-slate-800">Borrower</span>
            </div>
            <ReviewField label="Name" value={`${parsed.firstName ?? ''} ${parsed.lastName ?? ''}`.trim() || undefined} />
            <ReviewField label="DOB" value={parsed.dob} />
            <ReviewField label="Email" value={parsed.email} />
            <ReviewField label="Phone" value={parsed.phone} />
            <ReviewField label="Employment" value={parsed.employmentType} />
            <ReviewField label="Credit Score" value={parsed.creditScore} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={15} className="text-green-500" />
              <span className="text-sm font-semibold text-slate-800">Income</span>
            </div>
            <ReviewField label="Base Salary" value={parsed.baseSalary ? `$${parsed.baseSalary.toLocaleString()}` : undefined} />
            <ReviewField label="Employer" value={parsed.employerName} />
            <ReviewField label="Years Employed" value={parsed.yearsEmployed} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={15} className="text-green-500" />
              <span className="text-sm font-semibold text-slate-800">Property & Terms</span>
            </div>
            <ReviewField label="Address" value={parsed.address} />
            <ReviewField label="City" value={parsed.city} />
            <ReviewField label="Province" value={parsed.province} />
            <ReviewField label="Purchase Price" value={parsed.purchasePrice ? `$${parsed.purchasePrice.toLocaleString()}` : undefined} />
            <ReviewField label="Down Payment" value={parsed.downPayment ? `$${parsed.downPayment.toLocaleString()}` : undefined} />
            <ReviewField label="Rate" value={parsed.contractRate ? `${parsed.contractRate}%` : undefined} />
            <ReviewField label="Amortization" value={parsed.amortizationYears ? `${parsed.amortizationYears} yrs` : undefined} />
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No data extracted</p>
            <p className="text-sm text-amber-700 mt-0.5">
              The application will be created as a blank draft. You can fill in all details on the next screen.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStage('intake')}
          className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
        >
          Back to intake
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md hover:shadow-lg hover:opacity-95 transition-all disabled:opacity-60"
        >
          {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          Create Application
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
