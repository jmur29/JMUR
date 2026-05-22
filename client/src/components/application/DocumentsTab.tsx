import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Upload, Trash2, FileText, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { documentsApi, DOCUMENT_TYPE_LABELS } from '../../lib/api';
import type { Application, DocumentStatus, DocumentType } from '../../types';
import { appKeys } from '../../hooks/useApplication';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { formatDate, cn } from '../../lib/utils';

const DOC_TYPE_OPTIONS = (
  Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]
).map((k) => ({ value: k, label: DOCUMENT_TYPE_LABELS[k] }));

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

function getDocStatusStyle(status: DocumentStatus): string {
  const map: Record<DocumentStatus, string> = {
    PENDING: 'bg-slate-100 text-slate-600',
    REVIEWED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  return map[status];
}

function getDocStatusIcon(status: DocumentStatus) {
  const iconClass = 'w-3.5 h-3.5';
  switch (status) {
    case 'PENDING': return <Clock className={iconClass} />;
    case 'REVIEWED': return <Eye className={iconClass} />;
    case 'APPROVED': return <CheckCircle className={iconClass} />;
    case 'REJECTED': return <XCircle className={iconClass} />;
  }
}

interface DocumentsTabProps {
  application: Application;
}

export default function DocumentsTab({ application }: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<DocumentType>('OTHER');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', application.id],
    queryFn: () => documentsApi.list(application.id),
    initialData: application.documents,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, type }: { file: File; type: DocumentType }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      return documentsApi.upload(application.id, fd, (pct) => {
        setUploadProgress((prev) => ({ ...prev, [file.name]: pct }));
      });
    },
    onSuccess: (_doc, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', application.id] });
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[variables.file.name];
        return next;
      });
      toast.success('Document uploaded');
    },
    onError: (_err, variables) => {
      setUploadProgress((prev) => {
        const next = { ...prev };
        delete next[variables.file.name];
        return next;
      });
      toast.error('Upload failed');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: DocumentStatus }) =>
      documentsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', application.id] });
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', application.id] });
      queryClient.invalidateQueries({ queryKey: appKeys.detail(application.id) });
      toast.success('Document deleted');
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        uploadMutation.mutate({ file, type: selectedType });
      }
    },
    [uploadMutation, selectedType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 25 * 1024 * 1024, // 25MB
  });

  const pendingUploads = Object.entries(uploadProgress);

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="w-56">
            <Select
              label="Document Type"
              value={selectedType}
              options={DOC_TYPE_OPTIONS}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
            />
          </div>
          <p className="text-xs text-slate-400 pb-2">Select type before dropping files</p>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'
          )}
        >
          <input {...getInputProps()} />
          <Upload size={28} className={cn('mx-auto mb-3', isDragActive ? 'text-blue-500' : 'text-slate-400')} />
          <p className="text-sm font-medium text-slate-700">
            {isDragActive ? 'Drop files here…' : 'Drag & drop files, or click to browse'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            PDF, JPG, PNG, DOC, DOCX · Max 25 MB each
          </p>
        </div>

        {/* Upload progress */}
        {pendingUploads.map(([name, pct]) => (
          <div key={name} className="flex items-center gap-3 text-sm">
            <FileText size={14} className="text-slate-400 flex-shrink-0" />
            <span className="flex-1 truncate text-slate-600">{name}</span>
            <div className="w-32 bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs w-10 text-right">{pct}%</span>
          </div>
        ))}
      </div>

      {/* Documents table */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading documents…</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-400 text-sm">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  Uploaded
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-slate-400 flex-shrink-0" />
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[200px]"
                      >
                        {doc.name}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {DOCUMENT_TYPE_LABELS[doc.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          getDocStatusStyle(doc.status)
                        )}
                      >
                        {getDocStatusIcon(doc.status)}
                        {doc.status}
                      </span>
                    </div>
                    <select
                      className="mt-1.5 text-xs border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={doc.status}
                      onChange={(e) =>
                        updateStatusMutation.mutate({
                          id: doc.id,
                          status: e.target.value as DocumentStatus,
                        })
                      }
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                    {formatDate(doc.uploadedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Trash2 size={13} />}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Delete this document?')) deleteMutation.mutate(doc.id);
                      }}
                      loading={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
