'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Tono = 'exito' | 'error';
type ToastItem = { id: number; mensaje: string; tono: Tono };

const ToastContext = createContext<{
  mostrar: (mensaje: string, tono?: Tono) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const mostrar = useCallback((mensaje: string, tono: Tono = 'exito') => {
    const id = Date.now() + Math.random();
    setToasts((actuales) => [...actuales, { id, mensaje, tono }]);
    setTimeout(() => {
      setToasts((actuales) => actuales.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-md border px-4 py-3 text-sm shadow-sm ${
              t.tono === 'exito'
                ? 'border-[var(--success)]/20 bg-[var(--success-bg)] text-[var(--success)]'
                : 'border-[var(--danger)]/20 bg-[var(--danger-bg)] text-[var(--danger)]'
            }`}
          >
            {t.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
