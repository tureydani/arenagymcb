'use client';

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar…',
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-sm rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
    />
  );
}
