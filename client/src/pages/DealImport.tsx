import React, { useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { intakeApi } from '../lib/api';
import Spinner from '../components/ui/Spinner';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type TabId = 'finmo' | 'notes' | 'manual';

const TABS: { id: TabId; label: string }[] = [
  { id: 'finmo', label: 'Finmo PDF' },
  { id: 'notes', label: 'Submission Notes' },
  { id: 'manual', label: 'Manual Entry' },
];

// ---------------------------------------------------------------------------
// Finmo PDF tab
// ---------------------------------------------------------------------------
function FinmoTab() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (formData: FormData) => intakeApi.importFinmo(formData, setProgress),
    onSuccess: (data) => navigate(`/applications/${data.applicationId}`),
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    mutation.reset();
  }, [mutation]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const submit = useCallback(() => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    mutation.mutate(formData);
  }, [file, mutation]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B6860]">
        Upload a PDF exported from Finmo. The AI will extract all deal fields automatically.
      </p>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !mutation.isPending && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
          dragOver
            ? 'border-[#1B4332] bg-[#D1FAE5]'
            : 'border-[#E8E6E1] bg-[#F7F6F3] hover:border-[#1B4332] hover:bg-[#D1FAE5]/20',
          mutation.isPending && 'pointer-events-none opacity-60'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onFileInput}
        />
        <Upload size={32} className="mx-auto mb-3 text-[#6B6860]" />
        {file ? (
          <>
            <p className="text-sm font-medium text-[#1A1916]">{file.name}</p>
            <p className="text-xs text-[#6B6860] mt-1">{(file.size / 1024).toFixed(0)} KB</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-[#1A1916]">Drop a Finmo PDF here</p>
            <p className="text-xs text-[#6B6860] mt-1">or click to browse</p>
          </>
        )}
      </div>

      {/* Actions */}
      {file && !mutation.isPending && !mutation.isSuccess && (
        <button onClick={submit} className="btn-primary w-full flex items-center justify-center gap-2">
          Parse Finmo deal <ArrowRight size={14} />
        </button>
      )}

      {/* Loading */}
      {mutation.isPending && (
        <div className="flex items-center gap-3 text-sm text-[#6B6860]">
          <Spinner size="sm" />
          <span>Parsing Finmo deal{progress > 0 ? ` — ${progress}%` : '...'}</span>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <div className="flex items-center gap-2 text-xs text-[#991B1B] bg-[#FEE2E2] rounded-lg px-3 py-2">
          <AlertCircle size={12} />
          {mutation.error instanceof Error ? mutation.error.message : 'Upload failed. Please try again.'}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission Notes tab
// ---------------------------------------------------------------------------
function NotesTab() {
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const mutation = useMutation({
    mutationFn: (t: string) => intakeApi.importSubmissionNotes(t),
    onSuccess: (data) => navigate(`/applications/${data.applicationId}`),
  });

  const submit = () => {
    if (!text.trim()) return;
    mutation.mutate(text.trim());
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B6860]">
        Paste broker submission notes, a Velocity deal summary, or any unstructured deal text.
        The AI will extract borrower, property, and mortgage fields.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste broker submission notes, Velocity deal summary, or any unstructured deal text..."
        rows={12}
        disabled={mutation.isPending}
        className={cn(
          'w-full rounded-xl border border-[#E8E6E1] bg-white px-4 py-3 text-sm text-[#1A1916]',
          'placeholder:text-[#6B6860] focus:outline-none focus:border-[#1B4332] resize-none',
          mutation.isPending && 'opacity-60'
        )}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-[#6B6860]">{text.length} characters</span>
        <button
          onClick={submit}
          disabled={!text.trim() || mutation.isPending}
          className={cn(
            'btn-primary flex items-center gap-2',
            (!text.trim() || mutation.isPending) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {mutation.isPending ? (
            <>
              <Spinner size="sm" />
              Parsing...
            </>
          ) : (
            <>
              Parse <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div className="flex items-center gap-2 text-xs text-[#991B1B] bg-[#FEE2E2] rounded-lg px-3 py-2">
          <AlertCircle size={12} />
          {mutation.error instanceof Error ? mutation.error.message : 'Parse failed. Please try again.'}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Entry tab
// ---------------------------------------------------------------------------
function ManualTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B6860]">
        Enter all borrower, property, and mortgage details manually.
        Use this when you have the data ready and prefer direct input.
      </p>
      <div className="rounded-xl border border-[#E8E6E1] bg-[#F7F6F3] p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#E8E6E1] flex items-center justify-center mx-auto mb-3">
          <FileText size={18} className="text-[#6B6860]" />
        </div>
        <p className="text-sm font-medium text-[#1A1916] mb-1">Manual Application Form</p>
        <p className="text-xs text-[#6B6860] mb-4">
          Complete the multi-step form to create a new application from scratch.
        </p>
        <Link
          to="/applications/new"
          className="btn-primary inline-flex items-center gap-2"
        >
          Start manual entry <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DealImport page
// ---------------------------------------------------------------------------
export default function DealImport() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) ?? 'finmo';
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'finmo'
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1A1916]">Deal Import</h1>
        <p className="text-sm text-[#6B6860] mt-0.5">Import a deal from various sources to begin underwriting.</p>
      </div>

      {/* Card with tabs */}
      <div className="card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-[#E8E6E1] bg-white">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-[#1B4332] text-[#1B4332]'
                  : 'border-transparent text-[#6B6860] hover:text-[#1A1916]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'finmo' && <FinmoTab />}
          {activeTab === 'notes' && <NotesTab />}
          {activeTab === 'manual' && <ManualTab />}
        </div>
      </div>
    </div>
  );
}
