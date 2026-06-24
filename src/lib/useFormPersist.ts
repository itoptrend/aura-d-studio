import { useState, useCallback, useEffect, useRef } from 'react';

type FormState<T> = { values: T; savedAt: string | null };

/**
 * Persists form state to localStorage so data survives navigation AND browser close.
 * Auto-saves on every keystroke. Shows last-saved timestamp.
 *
 * Returns { values, setField, clearForm, saveForm, savedAt }
 * - setField: update a single field (auto-saves to localStorage)
 * - clearForm: wipe both localStorage and state (call after successful submit or user clears)
 * - saveForm: manual save (for "💾 บันทึก" button) — same as auto-save but explicit
 * - savedAt: ISO timestamp string of last save, or null
 */
export function useFormPersist<T extends Record<string, string>>(
  key: string,
  initialValues: T
): {
  values: T;
  setField: (field: keyof T, value: string) => void;
  clearForm: () => void;
  saveForm: () => void;
  savedAt: string | null;
} {
  const storageKey = `aura_form_${key}`;

  // Read saved state once on first render (client-side only)
  const [state, setState] = useState<FormState<T>>(() => {
    if (typeof window === 'undefined') return { values: initialValues, savedAt: null };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as FormState<T>;
        return { values: { ...initialValues, ...parsed.values }, savedAt: parsed.savedAt ?? null };
      }
    } catch { /* ignore */ }
    return { values: initialValues, savedAt: null };
  });

  // Auto-save to localStorage whenever values change
  const valuesRef = useRef(state.values);
  valuesRef.current = state.values;

  function persist(values: T) {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(storageKey, JSON.stringify({ values, savedAt }));
    } catch { /* ignore — storage full or private mode */ }
    return savedAt;
  }

  const setField = useCallback((field: keyof T, value: string) => {
    setState((prev) => {
      const next = { ...prev.values, [field]: value };
      const savedAt = persist(next);
      return { values: next, savedAt };
    });
  }, [storageKey]);

  const clearForm = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setState({ values: initialValues, savedAt: null });
  }, [storageKey, initialValues]);

  // Manual save (same as auto-save, but explicit — for "💾 บันทึก" button)
  const saveForm = useCallback(() => {
    const savedAt = persist(valuesRef.current);
    setState((prev) => ({ ...prev, savedAt }));
  }, [storageKey]);

  return { values: state.values, setField, clearForm, saveForm, savedAt: state.savedAt };
}

/** Format savedAt ISO string to Thai locale short time */
export function formatSavedAt(savedAt: string | null): string | null {
  if (!savedAt) return null;
  try {
    return new Date(savedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return null; }
}
