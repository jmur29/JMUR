import Modal from '../ui/Modal';
import type { Document } from '../../types';
import { DOCUMENT_TYPE_LABELS } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Download } from 'lucide-react';

interface DocumentViewerProps {
  document: Document | null;
  onClose: () => void;
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function isImage(filename: string): boolean {
  return IMAGE_EXTS.has(getExtension(filename));
}

function isPdf(filename: string): boolean {
  return getExtension(filename) === 'pdf';
}

export default function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const isOpen = document !== null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="max-w-3xl"
    >
      {document && (
        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">
                {document.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                  {DOCUMENT_TYPE_LABELS[document.type]}
                </span>
                <span className="text-xs text-slate-400">
                  Uploaded {formatDate(document.uploadedAt)}
                </span>
                {document.uploadedBy && (
                  <span className="text-xs text-slate-400">
                    by {document.uploadedBy.firstName} {document.uploadedBy.lastName}
                  </span>
                )}
              </div>
            </div>

            {/* Download link */}
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Download size={14} />
              Download
            </a>
          </div>

          {/* Preview area */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            {isImage(document.name) ? (
              <div className="flex items-center justify-center p-4 min-h-[320px] max-h-[520px]">
                <img
                  src={document.url}
                  alt={document.name}
                  className="max-w-full max-h-[480px] object-contain rounded-lg shadow"
                />
              </div>
            ) : isPdf(document.name) ? (
              <iframe
                src={document.url}
                title={document.name}
                className="w-full h-[520px] border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center min-h-[200px]">
                <p className="text-slate-500 font-medium mb-1">Preview not available</p>
                <p className="text-slate-400 text-sm mb-4">
                  This file type cannot be previewed in the browser.
                </p>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download size={14} />
                  Download file
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
