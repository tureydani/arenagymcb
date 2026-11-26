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

type Maquina = {
  id_maquina: number;
  nombre: string;
  grupo_muscular: string;
  descripcion: string | null;
  imagen_url: string | null;
  operativa: boolean;
  activo: boolean;
};

export default function MaquinasPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar } =
    useCrudResource<Maquina>('maquinas');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Maquina | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Maquina | null>(null);
  const [cambiandoOperativa, setCambiandoOperativa] = useState<Maquina | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const datos = {
      nombre: form.get('nombre') as string,
      grupo_muscular: form.get('grupo_muscular') as string,
      descripcion: (form.get('descripcion') as string) || null,
      imagen_url: (form.get('imagen_url') as string) || null,
    };

    try {
      if (editando) {
        await actualizar(editando.id_maquina, datos);
        mostrar('Máquina actualizada');
      } else {
        await crear(datos);
        mostrar('Máquina creada');
      }
      setModalAbierto(false);
    } catch {
      mostrar(editando ? 'No se pudo actualizar' : 'No se pudo crear la máquina', 'error');
    }
  }

  async function cambiarEstado() {
    if (!cambiandoEstado) return;
    await actualizar(cambiandoEstado.id_maquina, { activo: !cambiandoEstado.activo });
    mostrar(cambiandoEstado.activo ? 'Máquina desactivada' : 'Máquina activada');
  }

  async function cambiarOperativa() {
    if (!cambiandoOperativa) return;
    await actualizar(cambiandoOperativa.id_maquina, { operativa: !cambiandoOperativa.operativa });
    mostrar(cambiandoOperativa.operativa ? 'Máquina marcada como fuera de servicio' : 'Máquina marcada como operativa');
  }

  const columnas: Columna<Maquina>[] = [
    { key: 'nombre', header: 'Máquina', render: (m) => m.nombre },
    { key: 'grupo', header: 'Grupo muscular', render: (m) => m.grupo_muscular },
    {
      key: 'operativa',
      header: 'Operativa',
      align: 'center',
      render: (m) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            m.operativa ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--warning-bg)] text-[var(--warning)]'
          }`}
        >
          {m.operativa ? 'Operativa' : 'Fuera de servicio'}
        </span>
      ),
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
          <h1 className="font-display text-xl font-semibold">Máquinas</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} máquinas</p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModalAbierto(true);
          }}
        >
          + Agregar máquina
        </Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por nombre o grupo muscular…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(m) => m.id_maquina}
          cargando={cargando}
          mensajeVacio="No hay máquinas creadas."
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
                titulo={m.operativa ? 'Marcar fuera de servicio' : 'Marcar operativa'}
                tono={m.operativa ? 'danger' : 'neutral'}
                onClick={() => setCambiandoOperativa(m)}
              >
                {m.operativa ? <IconBan /> : <IconCheck />}
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
        <Modal titulo={editando ? 'Editar máquina' : 'Agregar máquina'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Nombre">
              <input name="nombre" required defaultValue={editando?.nombre} className={inputClass} />
            </FormField>
            <FormField label="Grupo muscular">
              <input name="grupo_muscular" required defaultValue={editando?.grupo_muscular} className={inputClass} />
            </FormField>
            <FormField label="Descripción (opcional)">
              <input name="descripcion" defaultValue={editando?.descripcion ?? ''} className={inputClass} />
            </FormField>
            <FormField label="URL de imagen (opcional)">
              <input name="imagen_url" defaultValue={editando?.imagen_url ?? ''} className={inputClass} />
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
          titulo={cambiandoEstado.activo ? 'Desactivar máquina' : 'Activar máquina'}
          descripcion={`¿Confirmas ${cambiandoEstado.activo ? 'desactivar' : 'activar'} la máquina "${cambiandoEstado.nombre}"?`}
          tono="warning"
          onConfirm={cambiarEstado}
          onClose={() => setCambiandoEstado(null)}
        />
      )}

      {cambiandoOperativa && (
        <ConfirmDialog
          titulo={cambiandoOperativa.operativa ? 'Marcar fuera de servicio' : 'Marcar operativa'}
          descripcion={`¿Confirmas marcar "${cambiandoOperativa.nombre}" como ${
            cambiandoOperativa.operativa ? 'fuera de servicio' : 'operativa'
          }?`}
          tono="warning"
          onConfirm={cambiarOperativa}
          onClose={() => setCambiandoOperativa(null)}
        />
      )}
    </div>
  );
}
