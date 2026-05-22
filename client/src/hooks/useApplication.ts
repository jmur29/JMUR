import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import {
  applicationsApi,
  underwritingApi,
} from '../lib/api';
import type { ApplicationListParams, UWResult } from '../types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const appKeys = {
  all: ['applications'] as const,
  lists: () => [...appKeys.all, 'list'] as const,
  list: (params: ApplicationListParams) => [...appKeys.lists(), params] as const,
  details: () => [...appKeys.all, 'detail'] as const,
  detail: (id: string) => [...appKeys.details(), id] as const,
};

// ---------------------------------------------------------------------------
// useApplication — fetch single application by ID
// ---------------------------------------------------------------------------
export function useApplication(id: string) {
  return useQuery({
    queryKey: appKeys.detail(id),
    queryFn: () => applicationsApi.getById(id),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// useApplications — paginated/filtered list
// ---------------------------------------------------------------------------
export function useApplications(params: ApplicationListParams = {}) {
  return useQuery({
    queryKey: appKeys.list(params),
    queryFn: () => applicationsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

// ---------------------------------------------------------------------------
// useCalculate — run UW calculation for an application
// ---------------------------------------------------------------------------
export function useCalculate(id: string) {
  const queryClient = useQueryClient();

  return useMutation<UWResult, Error>({
    mutationFn: () => underwritingApi.calculate(id),
    onSuccess: () => {
      // Refresh the application to get updated decisions
      queryClient.invalidateQueries({ queryKey: appKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// useAutoSave — debounced auto-save hook
// ---------------------------------------------------------------------------
interface AutoSaveState {
  isDirty: boolean;
  isSaving: boolean;
  save: (data: unknown) => void;
  markDirty: () => void;
  markClean: () => void;
}

export function useAutoSave(
  mutationFn: (data: unknown) => Promise<unknown>,
  delay = 800
): AutoSaveState {
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestData = useRef<unknown>(null);

  const save = useCallback(
    (data: unknown) => {
      latestData.current = data;
      setIsDirty(true);

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await mutationFn(latestData.current);
          setIsDirty(false);
        } finally {
          setIsSaving(false);
        }
      }, delay);
    },
    [mutationFn, delay]
  );

  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);

  return { isDirty, isSaving, save, markDirty, markClean };
}
