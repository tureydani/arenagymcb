'use client';

export default function Pagination({
  page,
  limit,
  total,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (pagina: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  const desde = total === 0 ? 0 : (page - 1) * limit + 1;
  const hasta = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between border-t border-[var(--surface-border)] px-4 py-3 text-sm text-[var(--text-secondary)]">
      <span>
        {total === 0 ? 'Sin resultados' : `${desde}–${hasta} de ${total}`}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-[var(--surface-border)] px-3 py-1 disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPaginas}
          className="rounded-md border border-[var(--surface-border)] px-3 py-1 disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
