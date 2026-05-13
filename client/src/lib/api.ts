import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { useRef, useEffect } from 'react';
import type {
  Application,
  ApplicationListParams,
  Borrower,
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
      .post<Borrower>(`/applications/${appId}/borrowers`, data)
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
  create(borrowerId: string, data: Partial<Income>): Promise<Income> {
    return apiClient
      .post<Income>(`/borrowers/${borrowerId}/income`, data)
      .then((r) => r.data);
  },

  update(id: string, data: Partial<Income>): Promise<Income> {
    return apiClient.patch<Income>(`/income/${id}`, data).then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------
export const propertyApi = {
  create(appId: string, data: Partial<Property>): Promise<Property> {
    return apiClient
      .post<Property>(`/applications/${appId}/property`, data)
      .then((r) => r.data);
  },

  update(id: string, data: Partial<Property>): Promise<Property> {
    return apiClient.patch<Property>(`/property/${id}`, data).then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Mortgage Terms
// ---------------------------------------------------------------------------
export const termsApi = {
  create(appId: string, data: Partial<MortgageTerms>): Promise<MortgageTerms> {
    return apiClient
      .post<MortgageTerms>(`/applications/${appId}/terms`, data)
      .then((r) => r.data);
  },

  update(id: string, data: Partial<MortgageTerms>): Promise<MortgageTerms> {
    return apiClient.patch<MortgageTerms>(`/terms/${id}`, data).then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Underwriting
// ---------------------------------------------------------------------------
export const underwritingApi = {
  calculate(appId: string): Promise<UWResult> {
    return apiClient
      .post<UWResult>(`/applications/${appId}/calculate`)
      .then((r) => r.data);
  },

  saveDecision(appId: string, data: SaveDecisionPayload): Promise<Application> {
    return apiClient
      .post<Application>(`/applications/${appId}/decision`, data)
      .then((r) => r.data);
  },
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
export const documentsApi = {
  list(appId: string): Promise<Document[]> {
    return apiClient
      .get<Document[]>(`/applications/${appId}/documents`)
      .then((r) => r.data);
  },

  upload(
    appId: string,
    formData: FormData,
    onUploadProgress?: (pct: number) => void
  ): Promise<Document> {
    return apiClient
      .post<Document>(`/applications/${appId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (onUploadProgress && evt.total) {
            onUploadProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        },
      })
      .then((r) => r.data);
  },

  updateStatus(id: string, status: DocumentStatus): Promise<Document> {
    return apiClient
      .patch<Document>(`/documents/${id}`, { status })
      .then((r) => r.data);
  },

  delete(id: string): Promise<void> {
    return apiClient.delete(`/documents/${id}`).then(() => undefined);
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
    return apiClient.patch<User>(`/admin/users/${id}`, { role }).then((r) => r.data);
  },

  getPipelineStats(): Promise<PipelineStats> {
    return apiClient.get<PipelineStats>('/admin/pipeline').then((r) => r.data);
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
