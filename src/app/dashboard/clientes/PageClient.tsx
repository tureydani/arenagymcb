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
import api from '@/utils/api';

type Cliente = {
  id_cliente: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string | null;
  fecha_nacimiento: string;
  consentimiento_at: string | null;
  consentimiento_revocado_at: string | null;
  activo: boolean;
};

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

export default function ClientesPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar, recargar } =
    useCrudResource<Cliente>('clientes');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<Cliente | null>(null);
  const [otorgandoConsentimiento, setOtorgandoConsentimiento] = useState<Cliente | null>(null);
  const [revocandoConsentimiento, setRevocandoConsentimiento] = useState<Cliente | null>(null);

  function abrirCrear() {
    setEditando(null);
    setModalAbierto(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const datos = {
      nombre: form.get('nombre') as string,
      apellido: form.get('apellido') as string,
      telefono: form.get('telefono') as string,
      email: (form.get('email') as string) || null,
      fecha_nacimiento: form.get('fecha_nacimiento') as string,
    };

    try {
      if (editando) {
        await actualizar(editando.id_cliente, datos);
        mostrar('Datos actualizados');
      } else {
        await crear(datos);
        mostrar('Cliente registrado');
      }
      setModalAbierto(false);
    } catch (err) {
      const mensaje =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (editando ? 'No se pudo actualizar' : 'No se pudo registrar el cliente');
      mostrar(mensaje, 'error');
    }
  }

  async function cambiarEstado() {
    if (!cambiandoEstado) return;
    await actualizar(cambiandoEstado.id_cliente, { activo: !cambiandoEstado.activo });
    mostrar(cambiandoEstado.activo ? 'Cliente desactivado' : 'Cliente activado');
  }

  async function otorgarConsentimiento(version?: string) {
    if (!otorgandoConsentimiento) return;
    try {
      await api.patch(`/clientes/${otorgandoConsentimiento.id_cliente}/consentimiento`, {
        accion: 'OTORGAR',
        version,
      });
      await recargar();
      mostrar('Consentimiento registrado');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function revocarConsentimiento() {
    if (!revocandoConsentimiento) return;
    try {
      await api.patch(`/clientes/${revocandoConsentimiento.id_cliente}/consentimiento`, { accion: 'REVOCAR' });
      await recargar();
      mostrar('Consentimiento revocado');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  function estadoConsentimiento(c: Cliente): 'FIRMADO' | 'REVOCADO' | 'PENDIENTE' {
    if (!c.consentimiento_at) return 'PENDIENTE';
    return c.consentimiento_revocado_at ? 'REVOCADO' : 'FIRMADO';
  }

  const columnas: Columna<Cliente>[] = [
    { key: 'nombre', header: 'Nombre', render: (c) => `${c.nombre} ${c.apellido}` },
    { key: 'telefono', header: 'Teléfono', render: (c) => c.telefono },
    { key: 'email', header: 'Email', render: (c) => c.email ?? '—' },
    {
      key: 'consentimiento',
      header: 'Consentimiento',
      align: 'center',
      render: (c) => {
        const estado = estadoConsentimiento(c);
        const estilos =
          estado === 'FIRMADO'
            ? 'bg-[var(--success-bg)] text-[var(--success)]'
            : estado === 'REVOCADO'
              ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
              : 'bg-[var(--warning-bg)] text-[var(--warning)]';
        return (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos}`}>
            {estado === 'FIRMADO' ? 'Firmado' : estado === 'REVOCADO' ? 'Revocado' : 'Pendiente'}
          </span>
        );
      },
    },
    {
      key: 'activo',
      header: 'Estado',
      align: 'center',
      render: (c) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            c.activo ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--danger-bg)] text-[var(--danger)]'
          }`}
        >
          {c.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} clientes registrados</p>
        </div>
        <Button onClick={abrirCrear}>+ Agregar cliente</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por nombre o teléfono…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(c) => c.id_cliente}
          cargando={cargando}
          mensajeVacio="No hay clientes registrados."
          acciones={(c) => (
            <>
              <RowActionButton
                titulo="Editar"
                onClick={() => {
                  setEditando(c);
                  setModalAbierto(true);
                }}
              >
                <IconPencil />
              </RowActionButton>
              <RowActionButton
                titulo={c.activo ? 'Desactivar' : 'Activar'}
                tono={c.activo ? 'danger' : 'neutral'}
                onClick={() => setCambiandoEstado(c)}
              >
                {c.activo ? <IconBan /> : <IconCheck />}
              </RowActionButton>
              {estadoConsentimiento(c) === 'FIRMADO' ? (
                <RowActionButton titulo="Revocar consentimiento" tono="danger" onClick={() => setRevocandoConsentimiento(c)}>
                  <IconBan />
                </RowActionButton>
              ) : (
                <RowActionButton titulo="Registrar consentimiento" onClick={() => setOtorgandoConsentimiento(c)}>
                  <IconCheck />
                </RowActionButton>
              )}
            </>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo={editando ? 'Editar cliente' : 'Agregar cliente'} onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Nombre">
              <input name="nombre" required defaultValue={editando?.nombre} className={inputClass} />
            </FormField>
            <FormField label="Apellido">
              <input name="apellido" required defaultValue={editando?.apellido} className={inputClass} />
            </FormField>
            <FormField label="Teléfono">
              <input name="telefono" required defaultValue={editando?.telefono} className={inputClass} />
            </FormField>
            <FormField label="Email (opcional)">
              <input name="email" type="email" defaultValue={editando?.email ?? ''} className={inputClass} />
            </FormField>
            <FormField label="Fecha de nacimiento">
              <input
                name="fecha_nacimiento"
                type="date"
                required
                defaultValue={editando?.fecha_nacimiento}
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
          titulo={cambiandoEstado.activo ? 'Desactivar cliente' : 'Activar cliente'}
          descripcion={`¿Confirmas ${cambiandoEstado.activo ? 'desactivar' : 'activar'} a ${cambiandoEstado.nombre} ${cambiandoEstado.apellido}?`}
          tono="warning"
          onConfirm={cambiarEstado}
          onClose={() => setCambiandoEstado(null)}
        />
      )}

      {otorgandoConsentimiento && (
        <Modal titulo="Registrar consentimiento informado" onClose={() => setOtorgandoConsentimiento(null)} ancho="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              otorgarConsentimiento(form.get('version') as string).then(() => setOtorgandoConsentimiento(null));
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-[var(--text-secondary)]">
              Confirma que {otorgandoConsentimiento.nombre} {otorgandoConsentimiento.apellido} firmó el consentimiento
              informado (requerido para evaluaciones físicas y rutinas con IA).
            </p>
            <FormField label="Versión del documento firmado">
              <input name="version" required defaultValue="v1.0" className={inputClass} />
            </FormField>
            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setOtorgandoConsentimiento(null)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        </Modal>
      )}

      {revocandoConsentimiento && (
        <ConfirmDialog
          titulo="Revocar consentimiento"
          descripcion={`¿Confirmas revocar el consentimiento informado de ${revocandoConsentimiento.nombre} ${revocandoConsentimiento.apellido}? No podrá tener nuevas evaluaciones ni rutinas con IA hasta que lo firme de nuevo.`}
          tono="danger"
          onConfirm={revocarConsentimiento}
          onClose={() => setRevocandoConsentimiento(null)}
        />
      )}
    </div>
  );
}
