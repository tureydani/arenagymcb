'use client';

/** Botón de acción de fila: siempre icono + tooltip (title), nunca texto.
 *  Un solo componente para que todas las tablas se vean igual. */
export default function RowActionButton({
  titulo,
  tono = 'neutral',
  onClick,
  children,
}: {
  titulo: string;
  tono?: 'neutral' | 'danger';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className={`rounded-md p-1.5 hover:bg-[var(--accent-bg)] ${
        tono === 'danger'
          ? 'text-[var(--danger)] hover:bg-[var(--danger-bg)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
      }`}
    >
      {children}
    </button>
  );
}
