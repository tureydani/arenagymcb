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
import { CANALES_COBRO } from '@/lib/canalesCobro';

type Pago = {
  id_pago: number;
  monto: string;
  canal_cobro: string;
  fecha_pago: string;
  anulado: boolean;
  observaciones: string | null;
  registro: {
    id_registro: number;
    cliente: { nombre: string; apellido: string; telefono: string };
    membresia: { nombre: string };
  };
};

type RegistroVigente = {
  id_registro: number;
  nombre: string;
  apellido: string;
  plan: string;
  fecha_fin: string;
};

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

export default function PagosPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, cerrar } =
    useCrudResource<Pago>('pagos');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [anulando, setAnulando] = useState<Pago | null>(null);
  const [registros, setRegistros] = useState<RegistroVigente[]>([]);

  useEffect(() => {
    if (!modalAbierto) return;
    api.get('/registro-membresias', { params: { limit: 100 } }).then(({ data }) => setRegistros(data.data));
  }, [modalAbierto]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await crear({
        id_registro: Number(form.get('id_registro')),
        monto: form.get('monto') as string,
        canal_cobro: form.get('canal_cobro') as string,
        observaciones: (form.get('observaciones') as string) || null,
      });
      mostrar('Pago registrado');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function anular(motivo?: string) {
    if (!anulando) return;
    try {
      await cerrar(anulando.id_pago, { motivo });
      mostrar('Pago anulado');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Pago>[] = [
    { key: 'fecha', header: 'Fecha', render: (p) => new Date(p.fecha_pago).toLocaleString('es-BO') },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (p) => `${p.registro.cliente.nombre} ${p.registro.cliente.apellido}`,
    },
    { key: 'plan', header: 'Plan', render: (p) => p.registro.membresia.nombre },
    { key: 'canal', header: 'Canal', render: (p) => p.canal_cobro },
    { key: 'monto', header: 'Monto (Bs)', align: 'right', render: (p) => Number(p.monto).toFixed(2) },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (p) => (p.anulado ? <span className="text-[var(--danger)]">Anulado</span> : 'Vigente'),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Pagos</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} pagos registrados</p>
        </div>
        <Button onClick={() => setModalAbierto(true)}>+ Registrar pago</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por cliente o teléfono…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(p) => p.id_pago}
          cargando={cargando}
          mensajeVacio="No hay pagos registrados."
          acciones={(p) =>
            !p.anulado && (
              <RowActionButton titulo="Anular" tono="danger" onClick={() => setAnulando(p)}>
                <IconBan />
              </RowActionButton>
            )
          }
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar pago" onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Inscripción (cliente — plan)">
              <select name="id_registro" required className={inputClass}>
                <option value="">Selecciona una inscripción</option>
                {registros.map((r) => (
                  <option key={r.id_registro} value={r.id_registro}>
                    {r.nombre} {r.apellido} — {r.plan} (vence {r.fecha_fin})
                  </option>
                ))}
              </select>
            </FormField>
            {registros.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)]">
                No hay membresías vigentes. Registra una inscripción primero.
              </p>
            )}
            <FormField label="Monto (Bs)">
              <input name="monto" type="number" min="0.01" step="0.01" required className={inputClass} />
            </FormField>
            <FormField label="Canal de cobro">
              <select name="canal_cobro" required className={inputClass}>
                <option value="">Selecciona un canal</option>
                {CANALES_COBRO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Observaciones (opcional)">
              <input name="observaciones" className={inputClass} />
            </FormField>

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
          titulo="Anular pago"
          descripcion={`Vas a anular el pago de Bs ${Number(anulando.monto).toFixed(2)} de ${anulando.registro.cliente.nombre} ${anulando.registro.cliente.apellido}. Esta acción queda registrada en auditoría.`}
          pedirMotivo
          onConfirm={anular}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
