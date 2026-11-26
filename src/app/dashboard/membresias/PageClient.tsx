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

type Membresia = {
  id_membresia: number;
  nombre: string;
  descripcion: string | null;
  duracion_dias: number;
  precio: string;
  limite_asistencias: number | null;
  activo: boolean;
};

export default function MembresiasPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar } =
    useCrudResource<Membresia>('membresias');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Membresia | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Membresia | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const limite = form.get('limite_asistencias') as string;
    const datos = {
      nombre: form.get('nombre') as string,
      descripcion: (form.get('descripcion') as string) || null,
      duracion_dias: Number(form.get('duracion_dias')),
      precio: form.get('precio') as string,
      limite_asistencias: limite ? Number(limite) : null,
    };

    try {
      if (editando) {
        await actualizar(editando.id_membresia, datos);
        mostrar('Plan actualizado');
      } else {
        await crear(datos);
        mostrar('Plan creado');
      }
      setModalAbierto(false);
    } catch {
      mostrar(editando ? 'No se pudo actualizar' : 'No se pudo crear el plan', 'error');
    }
  }

  async function cambiarEstado() {
    if (!cambiandoEstado) return;
    await actualizar(cambiandoEstado.id_membresia, { activo: !cambiandoEstado.activo });
    mostrar(cambiandoEstado.activo ? 'Plan desactivado' : 'Plan activado');
  }

  const columnas: Columna<Membresia>[] = [
    { key: 'nombre', header: 'Plan', render: (m) => m.nombre },
    { key: 'duracion', header: 'Duración', render: (m) => `${m.duracion_dias} días` },
    { key: 'precio', header: 'Precio', align: 'right', render: (m) => `Bs ${Number(m.precio).toFixed(2)}` },
    {
      key: 'limite',
      header: 'Asistencias',
      align: 'center',
      render: (m) => (m.limite_asistencias ? m.limite_asistencias : 'Ilimitado'),
    },
    {
      key: 'activo',
      header: 'Estado',
      align: 'center',
      render: (m) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            m.activo ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--danger-bg)] text-[var(--danger)]'
          }`}
        >
          {m.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Membresías</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} planes</p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModalAbierto(true);
          }}
        >
          + Agregar plan
        </Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por nombre…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(m) => m.id_membresia}
          cargando={cargando}
          mensajeVacio="No hay planes creados."
          acciones={(m) => (
            <>
              <RowActionButton
                titulo="Editar"
                onClick={() => {
                  setEditando(m);
                  setModalAbierto(true);
                }}
              >
                <IconPencil />
              </RowActionButton>
              <RowActionButton
                titulo={m.activo ? 'Desactivar' : 'Activar'}
                tono={m.activo ? 'danger' : 'neutral'}
                onClick={() => setCambiandoEstado(m)}
              >
                {m.activo ? <IconBan /> : <IconCheck />}
              </RowActionButton>
            </>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo={editando ? 'Editar plan' : 'Agregar plan'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Nombre">
              <input name="nombre" required defaultValue={editando?.nombre} className={inputClass} />
            </FormField>
            <FormField label="Descripción (opcional)">
              <input name="descripcion" defaultValue={editando?.descripcion ?? ''} className={inputClass} />
            </FormField>
            <FormField label="Duración (días)">
              <input
                name="duracion_dias"
                type="number"
                min={1}
                required
                defaultValue={editando?.duracion_dias}
                className={inputClass}
              />
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
            <FormField label="Límite de asistencias (vacío = ilimitado)">
              <input
                name="limite_asistencias"
                type="number"
                min={1}
                defaultValue={editando?.limite_asistencias ?? ''}
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
          titulo={cambiandoEstado.activo ? 'Desactivar plan' : 'Activar plan'}
          descripcion={`¿Confirmas ${cambiandoEstado.activo ? 'desactivar' : 'activar'} el plan "${cambiandoEstado.nombre}"?`}
          tono="warning"
          onConfirm={cambiarEstado}
          onClose={() => setCambiandoEstado(null)}
        />
      )}
    </div>
  );
}
