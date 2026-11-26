'use client';

import { useState } from 'react';
import { useCrudResource } from '@/hooks/useCrudResource';
import { useToast } from '@/components/ui/Toast';
import DataTable, { Columna } from '@/components/ui/DataTable';
import SearchBar from '@/components/ui/SearchBar';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FormField, { inputClass } from '@/components/ui/FormField';
import RowActionButton from '@/components/ui/RowActionButton';
import { IconBan, IconCheck, IconPencil } from '@/components/ui/icons';

type Producto = {
  id_producto: number;
  nombre: string;
  precio: string;
  stock: number;
  precio_mayoreo: string | null;
  cantidad_mayoreo: number | null;
  activo: boolean;
};

export default function ProductosPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar } =
    useCrudResource<Producto>('productos');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Producto | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorForm(null);
    const form = new FormData(e.currentTarget);
    const precioMayoreo = form.get('precio_mayoreo') as string;
    const cantidadMayoreo = form.get('cantidad_mayoreo') as string;
    const datos = {
      nombre: form.get('nombre') as string,
      precio: form.get('precio') as string,
      stock: Number(form.get('stock')),
      precio_mayoreo: precioMayoreo ? precioMayoreo : null,
      cantidad_mayoreo: cantidadMayoreo ? Number(cantidadMayoreo) : null,
    };

    try {
      if (editando) {
        await actualizar(editando.id_producto, datos);
        mostrar('Producto actualizado');
      } else {
        await crear(datos);
        mostrar('Producto creado');
      }
      setModalAbierto(false);
    } catch (err) {
      const mensaje =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (editando ? 'No se pudo actualizar' : 'No se pudo crear el producto');
      setErrorForm(mensaje);
      mostrar(mensaje, 'error');
    }
  }

  async function cambiarEstado() {
    if (!cambiandoEstado) return;
    await actualizar(cambiandoEstado.id_producto, { activo: !cambiandoEstado.activo });
    mostrar(cambiandoEstado.activo ? 'Producto desactivado' : 'Producto activado');
  }

  const columnas: Columna<Producto>[] = [
    { key: 'nombre', header: 'Producto', render: (p) => p.nombre },
    { key: 'precio', header: 'Precio', align: 'right', render: (p) => `Bs ${Number(p.precio).toFixed(2)}` },
    { key: 'stock', header: 'Stock', align: 'center', render: (p) => p.stock },
    {
      key: 'mayoreo',
      header: 'Mayoreo',
      align: 'center',
      render: (p) =>
        p.precio_mayoreo
          ? `Bs ${Number(p.precio_mayoreo).toFixed(2)} desde ${p.cantidad_mayoreo}`
          : '—',
    },
    {
      key: 'activo',
      header: 'Estado',
      align: 'center',
      render: (p) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            p.activo ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--danger-bg)] text-[var(--danger)]'
          }`}
        >
          {p.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Productos</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} productos</p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setErrorForm(null);
            setModalAbierto(true);
          }}
        >
          + Agregar producto
        </Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por nombre…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(p) => p.id_producto}
          cargando={cargando}
          mensajeVacio="No hay productos creados."
          acciones={(p) => (
            <>
              <RowActionButton
                titulo="Editar"
                onClick={() => {
                  setEditando(p);
                  setErrorForm(null);
                  setModalAbierto(true);
                }}
              >
                <IconPencil />
              </RowActionButton>
              <RowActionButton
                titulo={p.activo ? 'Desactivar' : 'Activar'}
                tono={p.activo ? 'danger' : 'neutral'}
                onClick={() => setCambiandoEstado(p)}
              >
                {p.activo ? <IconBan /> : <IconCheck />}
              </RowActionButton>
            </>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo={editando ? 'Editar producto' : 'Agregar producto'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {errorForm && (
              <p className="rounded-md bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">{errorForm}</p>
            )}
            <FormField label="Nombre">
              <input name="nombre" required defaultValue={editando?.nombre} className={inputClass} />
            </FormField>
            <FormField label="Precio (Bs)">
              <input
                name="precio"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={editando?.precio}
                className={inputClass}
              />
            </FormField>
            <FormField label="Stock">
              <input
                name="stock"
                type="number"
                min={0}
                required
                defaultValue={editando?.stock ?? 0}
                className={inputClass}
              />
            </FormField>
            <FormField label="Precio mayoreo (opcional)">
              <input
                name="precio_mayoreo"
                type="number"
                min={0}
                step="0.01"
                defaultValue={editando?.precio_mayoreo ?? ''}
                className={inputClass}
              />
            </FormField>
            <FormField label="Cantidad mínima para mayoreo (opcional)">
              <input
                name="cantidad_mayoreo"
                type="number"
                min={2}
                defaultValue={editando?.cantidad_mayoreo ?? ''}
                className={inputClass}
              />
            </FormField>

            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}

      {cambiandoEstado && (
        <ConfirmDialog
          titulo={cambiandoEstado.activo ? 'Desactivar producto' : 'Activar producto'}
          descripcion={`¿Confirmas ${cambiandoEstado.activo ? 'desactivar' : 'activar'} el producto "${cambiandoEstado.nombre}"?`}
          tono="warning"
          onConfirm={cambiarEstado}
          onClose={() => setCambiandoEstado(null)}
        />
      )}
    </div>
  );
}
