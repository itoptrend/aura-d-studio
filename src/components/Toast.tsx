'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

const COLORS: Record<ToastType, string> = {
  success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  error:   'border-red-500/50 bg-red-500/10 text-red-300',
  info:    'border-[#9C9690]/50 bg-[#1C1B23] text-bone',
};

const ICON_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500/20 text-emerald-400',
  error:   'bg-red-500/20 text-red-400',
  info:    'bg-[#2C2A35] text-[#9C9690]',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 3.5s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 300);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onRemove]);

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg max-w-sm transition-all duration-300 ${
        COLORS[toast.type]
      } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${ICON_COLORS[toast.type]}`}>
        {ICONS[toast.type]}
      </span>
      <p className="text-sm leading-relaxed flex-1">{toast.message}</p>
      <button onClick={() => { setVisible(false); setTimeout(onRemove, 300); }}
        className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 mt-0.5">✕</button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    toast:   addToast,
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    info:    (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container — bottom right */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
