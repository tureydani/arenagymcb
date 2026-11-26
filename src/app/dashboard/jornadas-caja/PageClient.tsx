'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { useToast } from '@/components/ui/Toast';
import DataTable, { Columna } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FormField, { inputClass } from '@/components/ui/FormField';
import RowActionButton from '@/components/ui/RowActionButton';
import { IconBan } from '@/components/ui/icons';
import { CATEGORIAS_CAJA } from '@/lib/categoriasCaja';

type Resumen = {
  saldo_inicial_efectivo: string;
  ingresos_efectivo: string;
  ingresos_qr: string;
  ingresos_transferencia: string;
  ingresos_tarjeta: string;
  otros_ingresos_efectivo: string;
  egresos_efectivo: string;
  efectivo_esperado_calculado: string;
};

type Jornada = {
  id_jornada: number;
  estado: string;
  fecha_apertura: string;
  saldo_inicial_efectivo: string;
  resumen: Resumen | null;
};

type Movimiento = {
  id_movimiento: number;
  tipo: 'INGRESO' | 'EGRESO';
  categoria: string;
  monto: string;
  concepto: string;
  fecha_hora: string;
  anulado: boolean;
};

const LIMIT = 20;

export default function JornadasCajaPage() {
  const { mostrar } = useToast();

  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [cargandoJornada, setCargandoJornada] = useState(true);

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [totalMovs, setTotalMovs] = useState(0);
  const [page, setPage] = useState(1);
  const [cargandoMovs, setCargandoMovs] = useState(false);

  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState<'INGRESO' | 'EGRESO' | null>(null);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [anulando, setAnulando] = useState<Movimiento | null>(null);

  const cargarJornada = useCallback(async () => {
    setCargandoJornada(true);
    try {
      const { data } = await api.get('/jornadas-caja/abierta');
      setJornada(data);
    } finally {
      setCargandoJornada(false);
    }
  }, []);

  const cargarMovimientos = useCallback(async (idJornada: number, pagina: number) => {
    setCargandoMovs(true);
    try {
      const { data } = await api.get('/movimientos-caja', {
        params: { id_jornada: idJornada, page: pagina, limit: LIMIT },
      });
      setMovimientos(data.data);
      setTotalMovs(data.total);
    } finally {
      setCargandoMovs(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarJornada();
  }, [cargarJornada]);

  useEffect(() => {
    if (jornada) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarMovimientos(jornada.id_jornada, page);
    } else {
      setMovimientos([]);
      setTotalMovs(0);
    }
  }, [jornada, page, cargarMovimientos]);

  async function abrirJornada(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await api.post('/jornadas-caja', {
        saldo_inicial_efectivo: Number(form.get('saldo_inicial_efectivo')),
        observaciones: form.get('observaciones') || undefined,
      });
      mostrar('Jornada abierta');
      setModalAbrir(false);
      setPage(1);
      await cargarJornada();
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function registrarMovimiento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modalMovimiento) return;
    const form = new FormData(e.currentTarget);
    try {
      await api.post('/movimientos-caja', {
        tipo: modalMovimiento,
        categoria: form.get('categoria'),
        monto: Number(form.get('monto')),
        concepto: form.get('concepto'),
      });
      mostrar(modalMovimiento === 'INGRESO' ? 'Ingreso registrado' : 'Egreso registrado');
      setModalMovimiento(null);
      await Promise.all([cargarJornada(), jornada && cargarMovimientos(jornada.id_jornada, page)]);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function anularMovimiento(motivo?: string) {
    if (!anulando) return;
    await api.patch(`/movimientos-caja/${anulando.id_movimiento}/anular`, { motivo });
    mostrar('Movimiento anulado');
    if (jornada) {
      await Promise.all([cargarJornada(), cargarMovimientos(jornada.id_jornada, page)]);
    }
  }

  async function cerrarJornada(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!jornada) return;
    const form = new FormData(e.currentTarget);
    try {
      await api.patch(`/jornadas-caja/${jornada.id_jornada}/cerrar`, {
        efectivo_contado: Number(form.get('efectivo_contado')),
        observaciones: form.get('observaciones') || undefined,
      });
      mostrar('Jornada cerrada');
      setModalCerrar(false);
      await cargarJornada();
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Movimiento>[] = [
    { key: 'fecha_hora', header: 'Fecha', render: (m) => new Date(m.fecha_hora).toLocaleString('es-BO') },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (m) => (
        <span className={m.tipo === 'INGRESO' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
          {m.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
        </span>
      ),
    },
    { key: 'categoria', header: 'Categoría', render: (m) => m.categoria },
    { key: 'concepto', header: 'Concepto', render: (m) => m.concepto },
    { key: 'monto', header: 'Monto (Bs)', align: 'right', render: (m) => Number(m.monto).toFixed(2) },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (m) => (m.anulado ? <span className="text-[var(--danger)]">Anulado</span> : 'Vigente'),
    },
  ];

  if (cargandoJornada) {
    return <p className="text-sm text-[var(--text-secondary)]">Cargando…</p>;
  }

  if (!jornada) {
    return (
      <div>
        <h1 className="font-display text-xl font-semibold">Caja</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">No hay una jornada de caja abierta.</p>
        <Button onClick={() => setModalAbrir(true)}>Abrir jornada</Button>

        {modalAbrir && (
          <Modal titulo="Abrir jornada" onClose={() => setModalAbrir(false)}>
            <form onSubmit={abrirJornada} className="flex flex-col gap-3">
              <FormField label="Saldo inicial en efectivo (Bs)">
                <input name="saldo_inicial_efectivo" type="number" min="0" step="0.01" required className={inputClass} />
              </FormField>
              <FormField label="Observaciones (opcional)">
                <textarea name="observaciones" rows={2} className={inputClass} />
              </FormField>
              <div className="mt-2 flex justify-end gap-2">
                <Button variante="secondary" onClick={() => setModalAbrir(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Abrir</Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  const r = jornada.resumen;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Caja</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Jornada abierta desde {new Date(jornada.fecha_apertura).toLocaleString('es-BO')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variante="secondary" onClick={() => setModalMovimiento('INGRESO')}>
            + Ingreso
          </Button>
          <Button variante="secondary" onClick={() => setModalMovimiento('EGRESO')}>
            + Egreso
          </Button>
          <Button onClick={() => setModalCerrar(true)}>Cerrar jornada</Button>
        </div>
      </div>

      {r && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tarjeta titulo="Saldo inicial" valor={r.saldo_inicial_efectivo} />
          <Tarjeta titulo="Ingresos efectivo" valor={r.ingresos_efectivo} />
          <Tarjeta titulo="Ingresos QR" valor={r.ingresos_qr} />
          <Tarjeta titulo="Ingresos tarjeta/transf." valor={(Number(r.ingresos_tarjeta) + Number(r.ingresos_transferencia)).toFixed(2)} />
          <Tarjeta titulo="Egresos" valor={r.egresos_efectivo} />
          <Tarjeta titulo="Efectivo esperado" valor={r.efectivo_esperado_calculado} destacado />
        </div>
      )}

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={movimientos}
          idKey={(m) => m.id_movimiento}
          cargando={cargandoMovs}
          mensajeVacio="Todavía no hay movimientos en esta jornada."
          acciones={(m) =>
            !m.anulado && (
              <RowActionButton titulo="Anular" tono="danger" onClick={() => setAnulando(m)}>
                <IconBan />
              </RowActionButton>
            )
          }
        />
        <Pagination page={page} limit={LIMIT} total={totalMovs} onPageChange={setPage} />
      </div>

      {modalMovimiento && (
        <Modal
          titulo={modalMovimiento === 'INGRESO' ? 'Registrar ingreso' : 'Registrar egreso'}
          onClose={() => setModalMovimiento(null)}
        >
          <form onSubmit={registrarMovimiento} className="flex flex-col gap-3">
            <FormField label="Categoría">
              <select name="categoria" required className={inputClass}>
                <option value="">Selecciona una categoría</option>
                {CATEGORIAS_CAJA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Monto (Bs)">
              <input name="monto" type="number" min="0.01" step="0.01" required className={inputClass} />
            </FormField>
            <FormField label="Concepto">
              <input name="concepto" required className={inputClass} />
            </FormField>
            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalMovimiento(null)}>
                Cancelar
              </Button>
              <Button type="submit">Registrar</Button>
            </div>
          </form>
        </Modal>
      )}

      {modalCerrar && (
        <Modal titulo="Cerrar jornada" onClose={() => setModalCerrar(false)}>
          <form onSubmit={cerrarJornada} className="flex flex-col gap-3">
            {r && (
              <p className="text-sm text-[var(--text-secondary)]">
                Efectivo esperado según el sistema: <strong>Bs {Number(r.efectivo_esperado_calculado).toFixed(2)}</strong>
              </p>
            )}
            <FormField label="Efectivo contado (Bs)">
              <input name="efectivo_contado" type="number" min="0" step="0.01" required className={inputClass} />
            </FormField>
            <FormField label="Observaciones (opcional)">
              <textarea name="observaciones" rows={2} className={inputClass} />
            </FormField>
            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalCerrar(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cerrar jornada</Button>
            </div>
          </form>
        </Modal>
      )}

      {anulando && (
        <ConfirmDialog
          titulo="Anular movimiento"
          descripcion={`Vas a anular el movimiento "${anulando.concepto}" (Bs ${Number(anulando.monto).toFixed(2)}). Esta acción queda registrada en auditoría.`}
          pedirMotivo
          onConfirm={anularMovimiento}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}

function Tarjeta({ titulo, valor, destacado }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        destacado
          ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
          : 'border-[var(--surface-border)] bg-[var(--surface)]'
      }`}
    >
      <p className="text-xs text-[var(--text-secondary)]">{titulo}</p>
      <p className="font-display text-lg font-semibold">Bs {Number(valor).toFixed(2)}</p>
    </div>
  );
}

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}
