'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
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
import { IconBan } from '@/components/ui/icons';

type Inscripcion = {
  id_registro: number;
  nombre: string;
  apellido: string;
  telefono: string;
  plan: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias_restantes: number;
  limite_asistencias: number | null;
  asistencias_usadas: number;
};

type OpcionSimple = { id: number; nombre: string };

export default function RegistroMembresiasPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, recargar } =
    useCrudResource<Inscripcion>('registro-membresias');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [anulando, setAnulando] = useState<Inscripcion | null>(null);
  const [clientes, setClientes] = useState<OpcionSimple[]>([]);
  const [membresias, setMembresias] = useState<OpcionSimple[]>([]);

  useEffect(() => {
    if (!modalAbierto) return;
    api.get('/clientes', { params: { limit: 100 } }).then(({ data }) =>
      setClientes(data.data.map((c: { id_cliente: number; nombre: string; apellido: string }) => ({
        id: c.id_cliente,
        nombre: `${c.nombre} ${c.apellido}`,
      })))
    );
    api.get('/membresias', { params: { limit: 100 } }).then(({ data }) =>
      setMembresias(data.data.map((m: { id_membresia: number; nombre: string }) => ({ id: m.id_membresia, nombre: m.nombre })))
    );
  }, [modalAbierto]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    try {
      await crear({
        id_cliente: Number(form.get('id_cliente')),
        id_membresia: Number(form.get('id_membresia')),
      });
      mostrar('Membresía registrada');
      setModalAbierto(false);
    } catch (err) {
      const mensaje =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'No se pudo registrar';
      mostrar(mensaje, 'error');
    }
  }

  async function anular(motivo?: string) {
    if (!anulando) return;
    await api.patch(`/registro-membresias/${anulando.id_registro}/anular`, { motivo });
    await recargar();
    mostrar('Inscripción anulada');
  }

  const columnas: Columna<Inscripcion>[] = [
    { key: 'cliente', header: 'Cliente', render: (r) => `${r.nombre} ${r.apellido}` },
    { key: 'plan', header: 'Plan', render: (r) => r.plan },
    { key: 'fecha_fin', header: 'Vence', render: (r) => r.fecha_fin },
    {
      key: 'dias_restantes',
      header: 'Días restantes',
      align: 'center',
      render: (r) => (
        <span
          className={
            r.dias_restantes <= 3
              ? 'rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]'
              : ''
          }
        >
          {r.dias_restantes}
        </span>
      ),
    },
    {
      key: 'asistencias',
      header: 'Asistencias',
      align: 'center',
      render: (r) => `${r.asistencias_usadas}${r.limite_asistencias ? ` / ${r.limite_asistencias}` : ''}`,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Inscripciones</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} membresías vigentes</p>
        </div>
        <Button onClick={() => setModalAbierto(true)}>+ Registrar inscripción</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por cliente o teléfono…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(r) => r.id_registro}
          cargando={cargando}
          mensajeVacio="No hay membresías vigentes."
          acciones={(r) => (
            <RowActionButton titulo="Anular" tono="danger" onClick={() => setAnulando(r)}>
              <IconBan />
            </RowActionButton>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar inscripción" onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Cliente">
              <select name="id_cliente" required className={inputClass}>
                <option value="">Selecciona un cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Plan">
              <select name="id_membresia" required className={inputClass}>
                <option value="">Selecciona un plan</option>
                {membresias.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </FormField>
            <p className="text-xs text-[var(--text-secondary)]">
              La fecha de vencimiento y el precio se calculan automáticamente a partir del plan elegido.
            </p>

            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        </Modal>
      )}

      {anulando && (
        <ConfirmDialog
          titulo="Anular inscripción"
          descripcion={`Vas a anular la membresía de ${anulando.nombre} ${anulando.apellido}. Esta acción queda registrada en auditoría.`}
          pedirMotivo
          onConfirm={anular}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
