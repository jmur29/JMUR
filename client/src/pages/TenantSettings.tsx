import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, Save, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantApi } from '../lib/api';
import type { Tenant } from '../types';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';

// ─── Color picker ─────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (raw: string) => {
    setHexInput(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
      onChange(raw);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
        />
      </div>
      <input
        type="text"
        value={hexInput}
        onChange={(e) => handleHexChange(e.target.value)}
        maxLength={7}
        placeholder="#1a56db"
        className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {/* Live preview swatch */}
      <div
        className="w-8 h-8 rounded-lg shadow-inner border border-slate-200"
        style={{ backgroundColor: value }}
      />
    </div>
  );
}

// ─── Logo dropzone ────────────────────────────────────────────────────────────

interface LogoDropzoneProps {
  currentLogoUrl: string | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}

function LogoDropzone({ currentLogoUrl, onUpload, uploading }: LogoDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        onUpload(acceptedFiles[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.svg', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  return (
    <div className="space-y-3">
      {currentLogoUrl && (
        <div className="flex items-center gap-3">
          <img
            src={currentLogoUrl}
            alt="Current logo"
            className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1"
          />
          <span className="text-sm text-slate-500">Current logo</span>
        </div>
      )}

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Spinner size="md" />
            <p className="text-sm text-slate-500">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={24} className="text-slate-400" />
            <p className="text-sm text-slate-600 font-medium">
              {isDragActive ? 'Drop logo here' : 'Drag & drop a logo, or click to browse'}
            </p>
            <p className="text-xs text-slate-400">PNG, JPG, SVG up to 5MB</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}

function PreviewPanel({ name, primaryColor, logoUrl }: PreviewPanelProps) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2 bg-slate-50 border-b border-slate-200">
        Live Preview
      </p>
      {/* Fake sidebar */}
      <div
        className="p-4 flex flex-col gap-3"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              className="w-8 h-8 object-contain rounded-lg bg-white/20 p-0.5 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/30 flex items-center justify-center flex-shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
          )}
          <span className="text-white font-semibold text-sm truncate">{name || 'Your Lender Name'}</span>
        </div>
        {/* Fake nav items */}
        {['Dashboard', 'Applications', 'Admin'].map((label) => (
          <div
            key={label}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs"
          >
            <div className="w-3 h-3 rounded-sm bg-white/30" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TenantSettings ───────────────────────────────────────────────────────────

export default function TenantSettings() {
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin', 'tenant'],
    queryFn: () => tenantApi.get(),
  });

  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1a56db');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Populate from fetched data
  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setPrimaryColor(tenant.primaryColor);
      setLogoUrl(tenant.logoUrl);
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; primaryColor?: string; logoUrl?: string }) =>
      tenantApi.update(data),
    onSuccess: (updated: Tenant) => {
      queryClient.setQueryData(['admin', 'tenant'], updated);
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => tenantApi.uploadLogo(file),
    onSuccess: (data: { logoUrl: string }) => {
      setLogoUrl(data.logoUrl);
      toast.success('Logo uploaded');
    },
    onError: () => toast.error('Failed to upload logo'),
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: name.trim() || undefined,
      primaryColor,
      logoUrl: logoUrl ?? undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tenant Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Customize your organization's branding and display settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Settings form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lender Name */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Organization</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Lender Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your organization name"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700">Branding</h2>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Primary Color
              </label>
              <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Logo
              </label>
              <LogoDropzone
                currentLogoUrl={logoUrl}
                onUpload={(file) => uploadMutation.mutate(file)}
                uploading={uploadMutation.isPending}
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              loading={updateMutation.isPending}
              onClick={handleSave}
            >
              Save Settings
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <div className="sticky top-6">
          <PreviewPanel
            name={name}
            primaryColor={primaryColor}
            logoUrl={logoUrl}
          />
        </div>
      </div>
    </div>
  );
}
