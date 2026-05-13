import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../lib/api';
import type { DocumentStatus } from '../types';
import { appKeys } from './useApplication';

// ---------------------------------------------------------------------------
// useDocuments — list documents for an application
// ---------------------------------------------------------------------------
export function useDocuments(applicationId: string) {
  return useQuery({
    queryKey: ['documents', applicationId],
    queryFn: () => documentsApi.list(applicationId),
    enabled: !!applicationId,
  });
}

// ---------------------------------------------------------------------------
// useUploadDocument
// ---------------------------------------------------------------------------
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      applicationId,
      formData,
    }: {
      applicationId: string;
      formData: FormData;
    }) => documentsApi.upload(applicationId, formData),
    onSuccess: (_, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', applicationId] });
      queryClient.invalidateQueries({ queryKey: appKeys.detail(applicationId) });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteDocument
// ---------------------------------------------------------------------------
export function useDeleteDocument(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', applicationId] });
      queryClient.invalidateQueries({ queryKey: appKeys.detail(applicationId) });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateDocumentStatus
// ---------------------------------------------------------------------------
export function useUpdateDocumentStatus(applicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      status,
    }: {
      documentId: string;
      status: DocumentStatus;
    }) => documentsApi.updateStatus(documentId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', applicationId] });
      queryClient.invalidateQueries({ queryKey: appKeys.detail(applicationId) });
    },
  });
}
