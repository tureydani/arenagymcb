'use client';

export type Columna<T> = {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (fila: T) => React.ReactNode;
};

export default function DataTable<T>({
  columnas,
  filas,
  idKey,
  cargando,
  mensajeVacio = 'No hay registros.',
  acciones,
}: {
  columnas: Columna<T>[];
  filas: T[];
  idKey: (fila: T) => string | number;
  cargando: boolean;
  mensajeVacio?: string;
  acciones?: (fila: T) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--surface-border)] text-left text-[var(--text-secondary)]">
            {columnas.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 font-medium ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {c.header}
              </th>
            ))}
            {acciones && <th className="px-4 py-3 text-right font-medium">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr>
              <td colSpan={columnas.length + (acciones ? 1 : 0)} className="px-4 py-10 text-center text-[var(--text-secondary)]">
                Cargando…
              </td>
            </tr>
          ) : filas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length + (acciones ? 1 : 0)} className="px-4 py-10 text-center text-[var(--text-secondary)]">
                {mensajeVacio}
              </td>
            </tr>
          ) : (
            filas.map((fila) => (
              <tr key={idKey(fila)} className="border-b border-[var(--surface-border)] last:border-0">
                {columnas.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                  >
                    {c.render(fila)}
                  </td>
                ))}
                {acciones && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">{acciones(fila)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
