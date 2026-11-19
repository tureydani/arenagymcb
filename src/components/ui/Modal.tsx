'use client';

import { useEffect } from 'react';

export default function Modal({
  titulo,
  onClose,
  children,
  ancho = 'max-w-lg',
}: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${ancho} rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
          <h2 className="font-display text-base font-semibold">{titulo}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[var(--text-secondary)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
