import { Request, Response, NextFunction } from 'express';
import { listNotes, createNote, updateNote, deleteNote } from '../services/notes';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listNotes(req.params.id, req.user.tenantId);
    if (result === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = req.body as { body: string };
    const result = await createNote(req.params.id, req.user.id, req.user.tenantId, body);
    if (result === null) {
      res.status(404).json({ error: 'Application not found', code: 'NOT_FOUND' });
      return;
    }
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = req.body as { body: string };
    const result = await updateNote(req.params.noteId, req.user.id, body);
    if (result === null) {
      res.status(404).json({ error: 'Note not found', code: 'NOT_FOUND' });
      return;
    }
    if ('forbidden' in result) {
      res.status(403).json({ error: 'You can only edit your own notes', code: 'FORBIDDEN' });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await deleteNote(req.params.noteId, req.user.id, req.user.tenantId, req.user.role);
    if (result === null) {
      res.status(404).json({ error: 'Note not found', code: 'NOT_FOUND' });
      return;
    }
    if ('forbidden' in result) {
      res.status(403).json({ error: 'Only the author or an admin can delete notes', code: 'FORBIDDEN' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
