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

type Asistencia = {
  id_asistencia: number;
  fecha_hora: string;
  metodo: 'QR' | 'MANUAL';
  anulado: boolean;
  cliente: { nombre: string; apellido: string; telefono: string };
  registro: { id_registro: number; membresia: { nombre: string } };
};

type OpcionCliente = { id: number; nombre: string };

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

export default function AsistenciasPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, cerrar } =
    useCrudResource<Asistencia>('asistencias');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [anulando, setAnulando] = useState<Asistencia | null>(null);
  const [clientes, setClientes] = useState<OpcionCliente[]>([]);

  useEffect(() => {
    if (!modalAbierto) return;
    api.get('/clientes', { params: { limit: 100 } }).then(({ data }) =>
      setClientes(
        data.data.map((c: { id_cliente: number; nombre: string; apellido: string }) => ({
          id: c.id_cliente,
          nombre: `${c.nombre} ${c.apellido}`,
        }))
      )
    );
  }, [modalAbierto]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await crear({
        id_cliente: Number(form.get('id_cliente')),
        metodo: form.get('metodo') as string,
      });
      mostrar('Asistencia registrada');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function anular(motivo?: string) {
    if (!anulando) return;
    try {
      await cerrar(anulando.id_asistencia, { motivo });
      mostrar('Asistencia anulada');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Asistencia>[] = [
    { key: 'fecha', header: 'Fecha', render: (a) => new Date(a.fecha_hora).toLocaleString('es-BO') },
    { key: 'cliente', header: 'Cliente', render: (a) => `${a.cliente.nombre} ${a.cliente.apellido}` },
    { key: 'plan', header: 'Plan', render: (a) => a.registro.membresia.nombre },
    {
      key: 'metodo',
      header: 'Método',
      align: 'center',
      render: (a) => (
        <span className="rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
          {a.metodo}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (a) => (a.anulado ? <span className="text-[var(--danger)]">Anulado</span> : 'Vigente'),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Asistencias</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} asistencias registradas</p>
        </div>
        <Button onClick={() => setModalAbierto(true)}>+ Registrar asistencia</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por cliente o teléfono…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(a) => a.id_asistencia}
          cargando={cargando}
          mensajeVacio="No hay asistencias registradas."
          acciones={(a) =>
            !a.anulado && (
              <RowActionButton titulo="Anular" tono="danger" onClick={() => setAnulando(a)}>
                <IconBan />
              </RowActionButton>
            )
          }
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar asistencia" onClose={() => setModalAbierto(false)}>
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
            <FormField label="Método">
              <select name="metodo" required defaultValue="MANUAL" className={inputClass}>
                <option value="MANUAL">Manual</option>
                <option value="QR">QR</option>
              </select>
            </FormField>
            <p className="text-xs text-[var(--text-secondary)]">
              Solo se puede registrar si el cliente tiene una membresía vigente y no ha marcado asistencia hoy.
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
          titulo="Anular asistencia"
          descripcion={`Vas a anular la asistencia de ${anulando.cliente.nombre} ${anulando.cliente.apellido}. Esta acción queda registrada en auditoría.`}
          pedirMotivo
          onConfirm={anular}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
