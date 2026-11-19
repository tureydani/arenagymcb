'use client';

import { useState } from 'react';
import Modal from './Modal';

/**
 * Confirmación genérica. Si `pedirMotivo` es true (anulaciones, que exigen
 * motivo por constraint en la DB), muestra un textarea obligatorio y lo
 * pasa a onConfirm; si no, onConfirm se llama sin argumento.
 */
export default function ConfirmDialog({
  titulo,
  descripcion,
  pedirMotivo = false,
  tono = 'danger',
  onConfirm,
  onClose,
}: {
  titulo: string;
  descripcion: string;
  pedirMotivo?: boolean;
  tono?: 'danger' | 'warning';
  onConfirm: (motivo?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function handleConfirm() {
    setEnviando(true);
    try {
      await onConfirm(pedirMotivo ? motivo : undefined);
      onClose();
    } finally {
      setEnviando(false);
    }
  }

  const colorBoton =
    tono === 'danger'
      ? 'bg-[var(--danger)] hover:bg-[var(--danger-hover)]'
      : 'bg-[var(--warning)] hover:brightness-95';

  return (
    <Modal titulo={titulo} onClose={onClose} ancho="max-w-md">
      <p className="text-sm text-[var(--text-secondary)]">{descripcion}</p>

      {pedirMotivo && (
        <textarea
          autoFocus
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (obligatorio)"
          rows={3}
          className="mt-3 w-full rounded-md border border-[var(--surface-border)] px-3 py-2 text-sm"
        />
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border border-[var(--surface-border)] px-3 py-1.5 text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={enviando || (pedirMotivo && !motivo.trim())}
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${colorBoton}`}
        >
          {enviando ? 'Procesando…' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}
