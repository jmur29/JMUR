import { useState, useRef, KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser } from '@clerk/clerk-react';
import { notesApi } from '../../lib/api';
import type { ApplicationNote } from '../../types';
import { cn } from '../../lib/utils';
import Button from '../ui/Button';
import StatusHistory from './StatusHistory';

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
  'bg-orange-500',
];

function avatarColor(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatNoteDate(iso: string): string {
  try {
    const date = parseISO(iso);
    const distance = formatDistanceToNow(date, { addSuffix: true });
    return distance;
  } catch {
    return iso;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NoteSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-5/6" />
      </div>
    </div>
  );
}

// ─── NoteItem ─────────────────────────────────────────────────────────────────

interface NoteItemProps {
  note: ApplicationNote;
  currentUserId: string;
  isAdmin: boolean;
  applicationId: string;
}

function NoteItem({ note, currentUserId, isAdmin, applicationId }: NoteItemProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(note.body);

  const canEdit = note.authorId === currentUserId;
  const canDelete = note.authorId === currentUserId || isAdmin;

  const firstName = note.author?.firstName ?? 'Unknown';
  const lastName = note.author?.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const color = avatarColor(fullName);

  const updateMutation = useMutation({
    mutationFn: (body: string) => notesApi.update(note.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', applicationId] });
      setEditing(false);
      toast.success('Note updated');
    },
    onError: () => toast.error('Failed to update note'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => notesApi.delete(note.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', applicationId] });
      toast.success('Note deleted');
    },
    onError: () => toast.error('Failed to delete note'),
  });

  const handleSave = () => {
    if (editBody.trim()) {
      updateMutation.mutate(editBody.trim());
    }
  };

  const handleCancelEdit = () => {
    setEditBody(note.body);
    setEditing(false);
  };

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5',
          color
        )}
      >
        {initials(firstName, lastName)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">{fullName}</span>
            <span className="text-xs text-slate-400">{formatNoteDate(note.createdAt)}</span>
            {note.updatedAt !== note.createdAt && (
              <span className="text-xs text-slate-400 italic">(edited)</span>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit note"
              >
                <Pencil size={13} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete note"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              autoFocus
              className="w-full border border-blue-400 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Check size={13} />}
                loading={updateMutation.isPending}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" leftIcon={<X size={13} />} onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{note.body}</p>
        )}
      </div>
    </div>
  );
}

// ─── NotesTimeline ────────────────────────────────────────────────────────────

interface NotesTimelineProps {
  applicationId: string;
}

export default function NotesTimeline({ applicationId }: NotesTimelineProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user: clerkUser } = useUser();
  const [newBody, setNewBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const role = (clerkUser?.publicMetadata?.role as string) ?? 'VIEWER';
  const isAdmin = role === 'ADMIN';
  // We need the DB userId; extract from Clerk's publicMetadata or use clerkId as fallback
  const currentDbUserId = (clerkUser?.publicMetadata?.dbUserId as string) ?? clerkUser?.id ?? '';

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', applicationId],
    queryFn: () => notesApi.list(applicationId),
    enabled: !!applicationId,
  });

  const createMutation = useMutation({
    mutationFn: (body: string) => notesApi.create(applicationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', applicationId] });
      setNewBody('');
      textareaRef.current?.focus();
    },
    onError: () => toast.error('Failed to add note'),
  });

  const handleSubmit = () => {
    const trimmed = newBody.trim();
    if (trimmed) {
      createMutation.mutate(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canComment = role === 'ADMIN' || role === 'UNDERWRITER';

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Notes</h3>

      {/* Add note area */}
      {canComment && (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="Add a note, flag an issue, or document a decision…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Cmd/Ctrl + Enter to submit</p>
            <Button
              size="sm"
              variant="primary"
              loading={createMutation.isPending}
              disabled={!newBody.trim()}
              onClick={handleSubmit}
            >
              Add Note
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <NoteSkeleton />
            <NoteSkeleton />
            <NoteSkeleton />
          </>
        ) : !notes || notes.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No notes yet. Add one to start the file history.
          </p>
        ) : (
          notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              currentUserId={currentDbUserId}
              isAdmin={isAdmin}
              applicationId={applicationId}
            />
          ))
        )}
      </div>

      {/* Status History collapsible section */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => setHistoryOpen((prev) => !prev)}
          className="flex items-center justify-between w-full text-left group"
        >
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Status History
          </h3>
          {historyOpen ? (
            <ChevronDown size={15} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
          ) : (
            <ChevronRight size={15} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
          )}
        </button>
        {historyOpen && (
          <div className="mt-4">
            <StatusHistory applicationId={applicationId} />
          </div>
        )}
      </div>
    </div>
  );
}
