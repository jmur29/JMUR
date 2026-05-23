import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useRef, useEffect } from 'react';
import type {
  Application,
  ApplicationListParams,
  Borrower,
  DealIntelligenceReport,
  DealReviewReport,
  Document,
  DocumentStatus,
  DocumentType,
  Income,
  MortgageTerms,
  PaginatedResponse,
  PipelineStats,
  Property,
  SaveDecisionPayload,
  User,
  UserRole,
  UWResult,
} from '../types';

// ---------------------------------------------------------------------------
// Base axios instance
// ---------------------------------------------------------------------------
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// The Clerk token is injected per-request via the hook below.
// For non-hook contexts the token can be set globally.
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status;
    if (status === 401) {
      // Let the Clerk provider handle redirect
      window.dispatchEvent(new CustomEvent('clearpath:unauthorized'));
    }
    return Promise.reject(err);
  }
);

// ---------------------------------------------------------------------------
// Hook: keeps the auth token refreshed
// ---------------------------------------------------------------------------
export function useApiAuth() {
  const { getToken } = useAuth();
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const refresh = async () => {
      const token = await getToken();
      setAuthToken(token);
    };
    refresh();
    interval.current = setInterval(refresh, 55_000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [getToken]);
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
export const applicationsApi = {
  list(params?: ApplicationListParams): Promise<PaginatedResponse<Application>> {
    return apiClient
      .get<PaginatedResponse<Application>>('/applications', { params })
      .then((r) => r.data);
  },

  create(data: Partial<Application>): Promise<Application> {
    return apiClient.post<Application>('/applications', data).then((r) => r.data);
  },

  getById(id: string): Promise<Application> {
    return apiClient.get<Application>(`/applications/${id}`).then((r) => r.data);
  },

  update(id: string, data: Partial<Application>): Promise<Application> {
    return apiClient.patch<Application>(`/applications/${id}`, data).then((r) => r.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/applications/${id}`).then(() => undefined);
  },
};

// ---------------------------------------------------------------------------
// Borrowers
// ---------------------------------------------------------------------------
export const borrowersApi = {
  create(appId: string, data: Partial<Borrower>): Promise<Borrower> {
    return apiClient
      .post<Borrower>('/borrowers', { applicationId: appId, ...data })
      .then((r) => r.data);
  },

  update(id: string, data: Partial<Borrower>): Promise<Borrower> {
    return apiClient.patch<Borrower>(`/borrowers/${id}`, data).then((r) => r.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/borrowers/${id}`).then(() => undefined);
  },
};

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------
export const incomeApi = {
  upsert(borrowerId: string, data: Partial<Income>): Promise<Income> {
    return apiClient
      .put<Income>(`/income/${borrowerId}`, data)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------
export const propertyApi = {
  upsert(appId: string, data: Partial<Property>): Promise<Property> {
    return apiClient
      .put<Property>(`/property/${appId}`, data)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Mortgage Terms
// ---------------------------------------------------------------------------
export const termsApi = {
  upsert(appId: string, data: Partial<MortgageTerms>): Promise<MortgageTerms> {
    return apiClient
      .put<MortgageTerms>(`/terms/${appId}`, data)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Underwriting
// ---------------------------------------------------------------------------
export const underwritingApi = {
  calculate(appId: string): Promise<UWResult> {
    return apiClient
      .get<UWResult>(`/underwriting/${appId}/calculate`)
      .then((r) => r.data);
  },

  saveDecision(appId: string, data: SaveDecisionPayload): Promise<Application> {
    return apiClient
      .post<Application>(`/underwriting/${appId}/decide`, data)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documentsApi = {
  list(appId: string): Promise<Document[]> {
    return apiClient
      .get<Document[]>(`/documents/${appId}`)
      .then((r) => r.data);
  },

  upload(
    appId: string,
    formData: FormData,
    onUploadProgress?: (pct: number) => void
  ): Promise<Document> {
    return apiClient
      .post<Document>(`/documents/${appId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (onUploadProgress && evt.total) {
            onUploadProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
      })
      .then((r) => r.data);
  },

  updateStatus(appId: string, id: string, status: DocumentStatus): Promise<Document> {
    return apiClient
      .patch<Document>(`/documents/${appId}/${id}/status`, { status })
      .then((r) => r.data);
  },

  delete(appId: string, id: string): Promise<void> {
    return apiClient.delete(`/documents/${appId}/${id}`).then(() => undefined);
  },
};

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export const reportsApi = {
  generate(appId: string): Promise<{ url: string }> {
    return apiClient
      .post<{ url: string }>(`/applications/${appId}/report`)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminApi = {
  listUsers(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<User>> {
    return apiClient
      .get<PaginatedResponse<User>>('/admin/users', { params })
      .then((r) => r.data);
  },

  updateUserRole(id: string, role: UserRole): Promise<User> {
    return apiClient.patch<User>(`/admin/users/${id}/role`, { role }).then((r) => r.data);
  },

  getPipelineStats(): Promise<PipelineStats> {
    return apiClient.get<PipelineStats>('/admin/pipeline').then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
export const aiApi = {
  parseSubmission(text: string): Promise<import('../types').ParsedApplication> {
    return apiClient.post('/ai/parse', { text }).then((r) => r.data);
  },

  reviewFile(applicationId: string): Promise<import('../types').DealIntelligence> {
    return apiClient.post('/ai/review', { applicationId }).then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------
export const intakeApi = {
  uploadZip(
    formData: FormData,
    onProgress?: (pct: number) => void
  ): Promise<{ applicationId: string; documentCount: number }> {
    return apiClient
      .post('/intake/zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (onProgress && evt.total) {
            onProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
        timeout: 120_000,
      })
      .then((r) => r.data);
  },

  importFinmo(
    formData: FormData,
    onProgress?: (pct: number) => void
  ): Promise<{ applicationId: string }> {
    return apiClient
      .post('/intake/finmo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (onProgress && evt.total) {
            onProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
        timeout: 120_000,
      })
      .then((r) => r.data);
  },

  importSubmissionNotes(text: string): Promise<{ applicationId: string }> {
    return apiClient
      .post('/intake/submission-notes', { text }, { timeout: 60_000 })
      .then((r) => r.data);
  },

  getDealIntelligence(appId: string): Promise<DealIntelligenceReport> {
    return apiClient
      .get(`/applications/${appId}/deal-intelligence`)
      .then((r) => r.data);
  },

  getDealReview(appId: string): Promise<DealReviewReport> {
    return apiClient
      .get(`/applications/${appId}/deal-review`)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Document type helper
// ---------------------------------------------------------------------------
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PAYSTUB: 'Pay Stub',
  T4: 'T4',
  NOA: 'Notice of Assessment',
  BANK_STATEMENT: 'Bank Statement',
  ID: 'Identification',
  APPRAISAL: 'Appraisal',
  OTHER: 'Other',
};
