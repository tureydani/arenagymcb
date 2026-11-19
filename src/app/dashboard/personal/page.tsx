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

type Personal = {
  id_personal: number;
  nombre: string;
  apellido: string;
  usuario: string;
  telefono: string | null;
  roles: string[];
  activo: boolean;
};

const ROLES = ['ADMIN', 'RECEPCION', 'ENTRENADOR'];

export default function PersonalPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar } =
    useCrudResource<Personal>('personal');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Personal | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Personal | null>(null);

  function abrirCrear() {
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(p: Personal) {
    setEditando(p);
    setModalAbierto(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const roles = ROLES.filter((r) => form.get(`rol_${r}`) === 'on');

    try {
      if (editando) {
        await actualizar(editando.id_personal, {
          nombre: form.get('nombre') as string,
          apellido: form.get('apellido') as string,
          telefono: form.get('telefono') as string,
          roles,
        });
        mostrar('Datos actualizados');
      } else {
        await crear({
          nombre: form.get('nombre') as string,
          apellido: form.get('apellido') as string,
          usuario: form.get('usuario') as string,
          password: form.get('password') as string,
          telefono: form.get('telefono') as string,
          roles,
        });
        mostrar('Usuario creado');
      }
      setModalAbierto(false);
    } catch {
      mostrar(editando ? 'No se pudo actualizar' : 'No se pudo crear el usuario', 'error');
    }
  }

  async function cambiarEstado() {
    if (!cambiandoEstado) return;
    await actualizar(cambiandoEstado.id_personal, { activo: !cambiandoEstado.activo });
    mostrar(cambiandoEstado.activo ? 'Usuario desactivado' : 'Usuario activado');
  }

  const columnas: Columna<Personal>[] = [
    { key: 'nombre', header: 'Nombre', render: (p) => `${p.nombre} ${p.apellido}` },
    { key: 'usuario', header: 'Usuario', render: (p) => p.usuario },
    { key: 'roles', header: 'Roles', render: (p) => p.roles.join(', ') },
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
          <h1 className="font-display text-xl font-semibold">Personal</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} personas registradas</p>
        </div>
        <Button onClick={abrirCrear}>+ Agregar personal</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por nombre o usuario…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(p) => p.id_personal}
          cargando={cargando}
          mensajeVacio="No hay personal registrado."
          acciones={(p) => (
            <>
              <RowActionButton titulo="Editar" onClick={() => abrirEditar(p)}>
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
        <Modal titulo={editando ? 'Editar personal' : 'Agregar personal'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Nombre">
              <input name="nombre" required defaultValue={editando?.nombre} className={inputClass} />
            </FormField>
            <FormField label="Apellido">
              <input name="apellido" required defaultValue={editando?.apellido} className={inputClass} />
            </FormField>
            {!editando && (
              <>
                <FormField label="Usuario">
                  <input name="usuario" required className={inputClass} />
                </FormField>
                <FormField label="Contraseña">
                  <input name="password" type="password" required className={inputClass} />
                </FormField>
              </>
            )}
            <FormField label="Teléfono">
              <input name="telefono" defaultValue={editando?.telefono ?? ''} className={inputClass} />
            </FormField>
            <FormField label="Roles">
              <div className="flex gap-4">
                {ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name={`rol_${r}`}
                      defaultChecked={editando?.roles.includes(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
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
          titulo={cambiandoEstado.activo ? 'Desactivar usuario' : 'Activar usuario'}
          descripcion={`¿Confirmas ${cambiandoEstado.activo ? 'desactivar' : 'activar'} a ${cambiandoEstado.nombre} ${cambiandoEstado.apellido}? ${cambiandoEstado.activo ? 'No podrá iniciar sesión mientras esté inactivo.' : ''}`}
          tono="warning"
          onConfirm={cambiarEstado}
          onClose={() => setCambiandoEstado(null)}
        />
      )}
    </div>
  );
}
