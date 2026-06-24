import { useState, useCallback, useRef } from 'react';

/**
 * Persists form state to sessionStorage so data survives navigation
 * between pages within the same browser tab.
 *
 * Usage:
 *   const [form, setField, clearForm] = useFormPersist('seo', { topic: '', keyword: '' });
 *   <input value={form.topic} onChange={(e) => setField('topic', e.target.value)} />
 *
 * Call clearForm() after a successful submission to reset the saved state.
 */
export function useFormPersist<T extends Record<string, string>>(
  key: string,
  initialValues: T
): [T, (field: keyof T, value: string) => void, () => void] {
  const storageKey = `aura_form_${key}`;

  // Read saved state once on first render (client-side only)
  const [values, setValues] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValues;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return { ...initialValues, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return initialValues;
  });

  // Keep a ref to latest values for the persist callback
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const setField = useCallback((field: keyof T, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  // Call after successful submission to clear saved state and reset form
  const clearForm = useCallback(() => {
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
    setValues(initialValues);
  }, [storageKey, initialValues]);

  return [values, setField, clearForm];
}
