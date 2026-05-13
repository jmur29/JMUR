import prisma from '../prisma/client';
import { logAction } from './audit';

const NOTE_AUTHOR_INCLUDE = {
  author: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

// ─── List notes ───────────────────────────────────────────────────────────────

export async function listNotes(applicationId: string, tenantId: string) {
  // Verify application belongs to tenant
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!app) return null;

  return prisma.applicationNote.findMany({
    where: { applicationId },
    include: NOTE_AUTHOR_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Create note ──────────────────────────────────────────────────────────────

export async function createNote(
  applicationId: string,
  authorId: string,
  tenantId: string,
  body: string
) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!app) return null;

  const note = await prisma.applicationNote.create({
    data: { applicationId, authorId, body },
    include: NOTE_AUTHOR_INCLUDE,
  });

  logAction(tenantId, authorId, applicationId, 'NOTE_CREATED', { noteId: note.id });

  return note;
}

// ─── Update note ──────────────────────────────────────────────────────────────

export async function updateNote(noteId: string, authorId: string, body: string) {
  const existing = await prisma.applicationNote.findUnique({
    where: { id: noteId },
    select: { authorId: true },
  });

  if (!existing) return null;
  if (existing.authorId !== authorId) return { forbidden: true } as const;

  return prisma.applicationNote.update({
    where: { id: noteId },
    data: { body },
    include: NOTE_AUTHOR_INCLUDE,
  });
}

// ─── Delete note ──────────────────────────────────────────────────────────────

export async function deleteNote(
  noteId: string,
  userId: string,
  tenantId: string,
  role: 'ADMIN' | 'UNDERWRITER' | 'VIEWER'
) {
  const existing = await prisma.applicationNote.findUnique({
    where: { id: noteId },
    select: { authorId: true, applicationId: true },
  });

  if (!existing) return null;

  const isAuthor = existing.authorId === userId;
  const isAdmin = role === 'ADMIN';

  if (!isAuthor && !isAdmin) return { forbidden: true } as const;

  await prisma.applicationNote.delete({ where: { id: noteId } });

  logAction(tenantId, userId, existing.applicationId, 'NOTE_DELETED', { noteId });

  return { deleted: true } as const;
}
