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
import { IconBan, IconCheck, IconPencil } from '@/components/ui/icons';

type Meta = {
  id_meta: number;
  tipo_medida: string;
  valor_inicial: string;
  valor_objetivo: string;
  valor_actual: string;
  fecha_objetivo: string | null;
  estado: 'ACTIVA' | 'CUMPLIDA' | 'CANCELADA';
  cliente: { nombre: string; apellido: string; telefono: string };
  entrenador: { nombre: string; apellido: string };
};

type OpcionCliente = { id: number; nombre: string };

const TIPOS_MEDIDA = [
  { value: 'PESO', label: 'Peso' },
  { value: 'CINTURA', label: 'Cintura' },
  { value: 'CADERA', label: 'Cadera' },
  { value: 'PECHO', label: 'Pecho' },
  { value: 'BRAZO', label: 'Brazo' },
  { value: 'MUSLO', label: 'Muslo' },
];

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

function progreso(m: Meta): number {
  const inicial = Number(m.valor_inicial);
  const objetivo = Number(m.valor_objetivo);
  const actual = Number(m.valor_actual);
  if (objetivo === inicial) return 0;
  const pct = ((actual - inicial) / (objetivo - inicial)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export default function MetasPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar } = useCrudResource<Meta>('metas');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [actualizandoProgreso, setActualizandoProgreso] = useState<Meta | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState<{ meta: Meta; nuevoEstado: 'CUMPLIDA' | 'CANCELADA' } | null>(null);
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
        tipo_medida: form.get('tipo_medida') as string,
        valor_inicial: form.get('valor_inicial') as string,
        valor_objetivo: form.get('valor_objetivo') as string,
        fecha_objetivo: (form.get('fecha_objetivo') as string) || null,
      });
      mostrar('Meta registrada');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function guardarProgreso(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actualizandoProgreso) return;
    const form = new FormData(e.currentTarget);
    try {
      await actualizar(actualizandoProgreso.id_meta, { valor_actual: form.get('valor_actual') as string });
      mostrar('Progreso actualizado');
      setActualizandoProgreso(null);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function confirmarCambioEstado() {
    if (!cambiandoEstado) return;
    try {
      await actualizar(cambiandoEstado.meta.id_meta, { estado: cambiandoEstado.nuevoEstado });
      mostrar(cambiandoEstado.nuevoEstado === 'CUMPLIDA' ? 'Meta marcada como cumplida' : 'Meta cancelada');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Meta>[] = [
    { key: 'cliente', header: 'Cliente', render: (m) => `${m.cliente.nombre} ${m.cliente.apellido}` },
    { key: 'tipo', header: 'Medida', render: (m) => TIPOS_MEDIDA.find((t) => t.value === m.tipo_medida)?.label ?? m.tipo_medida },
    {
      key: 'valores',
      header: 'Inicial → Objetivo',
      align: 'center',
      render: (m) => `${Number(m.valor_inicial).toFixed(1)} → ${Number(m.valor_objetivo).toFixed(1)}`,
    },
    {
      key: 'progreso',
      header: 'Progreso',
      render: (m) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-[var(--surface-border)]">
            <div
              className="h-1.5 rounded-full bg-[var(--accent)]"
              style={{ width: `${progreso(m)}%` }}
            />
          </div>
          <span className="text-xs text-[var(--text-secondary)]">{Number(m.valor_actual).toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (m) => {
        const estilos =
          m.estado === 'CUMPLIDA'
            ? 'bg-[var(--success-bg)] text-[var(--success)]'
            : m.estado === 'CANCELADA'
              ? 'bg-[var(--danger-bg)] text-[var(--danger)]'
              : 'bg-[var(--accent-bg)] text-[var(--accent)]';
        return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos}`}>{m.estado}</span>;
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Metas</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} metas registradas</p>
        </div>
        <Button onClick={() => setModalAbierto(true)}>+ Registrar meta</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por cliente…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(m) => m.id_meta}
          cargando={cargando}
          mensajeVacio="No hay metas registradas."
          acciones={(m) =>
            m.estado === 'ACTIVA' && (
              <>
                <RowActionButton titulo="Actualizar progreso" onClick={() => setActualizandoProgreso(m)}>
                  <IconPencil />
                </RowActionButton>
                <RowActionButton
                  titulo="Marcar cumplida"
                  onClick={() => setCambiandoEstado({ meta: m, nuevoEstado: 'CUMPLIDA' })}
                >
                  <IconCheck />
                </RowActionButton>
                <RowActionButton
                  titulo="Cancelar meta"
                  tono="danger"
                  onClick={() => setCambiandoEstado({ meta: m, nuevoEstado: 'CANCELADA' })}
                >
                  <IconBan />
                </RowActionButton>
              </>
            )
          }
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar meta" onClose={() => setModalAbierto(false)}>
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
            <FormField label="Medida">
              <select name="tipo_medida" required className={inputClass}>
                <option value="">Selecciona una medida</option>
                {TIPOS_MEDIDA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Valor inicial">
                <input name="valor_inicial" type="number" min="0.01" step="0.01" required className={inputClass} />
              </FormField>
              <FormField label="Valor objetivo">
                <input name="valor_objetivo" type="number" min="0.01" step="0.01" required className={inputClass} />
              </FormField>
            </div>
            <FormField label="Fecha objetivo (opcional)">
              <input name="fecha_objetivo" type="date" className={inputClass} />
            </FormField>
            <p className="text-xs text-[var(--text-secondary)]">
              Solo puede haber una meta activa por cliente y tipo de medida.
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

      {actualizandoProgreso && (
        <Modal titulo="Actualizar progreso" onClose={() => setActualizandoProgreso(null)} ancho="max-w-sm">
          <form onSubmit={guardarProgreso} className="flex flex-col gap-3">
            <FormField label="Valor actual">
              <input
                name="valor_actual"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={actualizandoProgreso.valor_actual}
                className={inputClass}
              />
            </FormField>
            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setActualizandoProgreso(null)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}

      {cambiandoEstado && (
        <ConfirmDialog
          titulo={cambiandoEstado.nuevoEstado === 'CUMPLIDA' ? 'Marcar meta como cumplida' : 'Cancelar meta'}
          descripcion={`¿Confirmas marcar la meta de ${cambiandoEstado.meta.cliente.nombre} ${cambiandoEstado.meta.cliente.apellido} como ${cambiandoEstado.nuevoEstado === 'CUMPLIDA' ? 'cumplida' : 'cancelada'}?`}
          tono={cambiandoEstado.nuevoEstado === 'CUMPLIDA' ? 'warning' : 'danger'}
          onConfirm={confirmarCambioEstado}
          onClose={() => setCambiandoEstado(null)}
        />
      )}
    </div>
  );
}
