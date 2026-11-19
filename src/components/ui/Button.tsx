'use client';

type Variante = 'primary' | 'secondary';

export default function Button({
  variante = 'primary',
  disabled,
  type = 'button',
  onClick,
  children,
}: {
  variante?: Variante;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const base = 'rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50';
  const estilos =
    variante === 'primary'
      ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
      : 'border border-[var(--surface-border)] text-[var(--foreground)] hover:bg-[var(--background)]';

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${estilos}`}>
      {children}
    </button>
  );
}
