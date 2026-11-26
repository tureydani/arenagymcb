'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { useCrudResource } from '@/hooks/useCrudResource';
import { useToast } from '@/components/ui/Toast';
import DataTable, { Columna } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import FormField, { inputClass } from '@/components/ui/FormField';
import RowActionButton from '@/components/ui/RowActionButton';
import { IconPencil } from '@/components/ui/icons';

type RegistroCumplimiento = {
  id_cumplimiento: number;
  fecha: string;
  series_realizadas: number | null;
  repeticiones_realizadas: number | null;
  peso_usado_kg: string | null;
  completado: boolean;
  observaciones: string | null;
  ejercicio: {
    dia: number;
    maquina: { nombre: string };
    rutina: { nombre: string; cliente: { nombre: string; apellido: string } };
  };
};

type OpcionRutina = { id_rutina: number; label: string };
type OpcionEjercicio = { id_rutina_ejercicio: number; label: string };

const DIAS_LABEL: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

export default function CumplimientoPage() {
  const { filas, total, page, limit, cargando, setPage, crear, actualizar } =
    useCrudResource<RegistroCumplimiento>('registros-cumplimiento');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<RegistroCumplimiento | null>(null);
  const [rutinas, setRutinas] = useState<OpcionRutina[]>([]);
  const [ejercicios, setEjercicios] = useState<OpcionEjercicio[]>([]);
  const [idRutina, setIdRutina] = useState('');

  function abrirCrear() {
    setIdRutina('');
    setEjercicios([]);
    setModalAbierto(true);
  }

  useEffect(() => {
    if (!modalAbierto) return;
    api.get('/rutinas', { params: { estado: 'ACTIVA', limit: 100 } }).then(({ data }) =>
      setRutinas(
        data.data.map((r: { id_rutina: number; nombre: string; cliente: { nombre: string; apellido: string } }) => ({
          id_rutina: r.id_rutina,
          label: `${r.cliente.nombre} ${r.cliente.apellido} — ${r.nombre}`,
        }))
      )
    );
  }, [modalAbierto]);

  useEffect(() => {
    if (!idRutina) return;
    api.get(`/rutinas/${idRutina}`).then(({ data }) =>
      setEjercicios(
        data.ejercicios.map(
          (ej: { id_rutina_ejercicio: number; dia: number; orden: number; maquina: { nombre: string } }) => ({
            id_rutina_ejercicio: ej.id_rutina_ejercicio,
            label: `${DIAS_LABEL[ej.dia]} · ${ej.maquina.nombre}`,
          })
        )
      )
    );
  }, [idRutina]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const leerNumero = (campo: string) => {
      const valor = form.get(campo) as string;
      return valor ? Number(valor) : null;
    };

    try {
      await crear({
        id_rutina_ejercicio: Number(form.get('id_rutina_ejercicio')),
        fecha: (form.get('fecha') as string) || undefined,
        series_realizadas: leerNumero('series_realizadas'),
        repeticiones_realizadas: leerNumero('repeticiones_realizadas'),
        peso_usado_kg: leerNumero('peso_usado_kg'),
        completado: form.get('completado') === 'on',
        observaciones: (form.get('observaciones') as string) || null,
      });
      mostrar('Cumplimiento registrado');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    const form = new FormData(e.currentTarget);
    const leerNumero = (campo: string) => {
      const valor = form.get(campo) as string;
      return valor ? Number(valor) : null;
    };

    try {
      await actualizar(editando.id_cumplimiento, {
        series_realizadas: leerNumero('series_realizadas'),
        repeticiones_realizadas: leerNumero('repeticiones_realizadas'),
        peso_usado_kg: (form.get('peso_usado_kg') as string) || null,
        completado: form.get('completado') === 'on',
        observaciones: (form.get('observaciones') as string) || null,
      });
      mostrar('Registro actualizado');
      setEditando(null);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<RegistroCumplimiento>[] = [
    { key: 'fecha', header: 'Fecha', render: (r) => r.fecha },
    {
      key: 'cliente',
      header: 'Cliente',
      render: (r) => `${r.ejercicio.rutina.cliente.nombre} ${r.ejercicio.rutina.cliente.apellido}`,
    },
    { key: 'rutina', header: 'Rutina', render: (r) => r.ejercicio.rutina.nombre },
    { key: 'ejercicio', header: 'Ejercicio', render: (r) => `${DIAS_LABEL[r.ejercicio.dia]} · ${r.ejercicio.maquina.nombre}` },
    {
      key: 'realizado',
      header: 'Series × Reps',
      align: 'center',
      render: (r) =>
        r.series_realizadas != null && r.repeticiones_realizadas != null
          ? `${r.series_realizadas} × ${r.repeticiones_realizadas}`
          : '—',
    },
    { key: 'peso', header: 'Peso (kg)', align: 'center', render: (r) => (r.peso_usado_kg ? Number(r.peso_usado_kg).toFixed(1) : '—') },
    {
      key: 'completado',
      header: 'Completado',
      align: 'center',
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            r.completado ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--warning-bg)] text-[var(--warning)]'
          }`}
        >
          {r.completado ? 'Sí' : 'No'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Cumplimiento de rutinas</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} registros</p>
        </div>
        <Button onClick={abrirCrear}>+ Registrar cumplimiento</Button>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(r) => r.id_cumplimiento}
          cargando={cargando}
          mensajeVacio="No hay registros de cumplimiento."
          acciones={(r) => (
            <RowActionButton titulo="Editar" onClick={() => setEditando(r)}>
              <IconPencil />
            </RowActionButton>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar cumplimiento" onClose={() => setModalAbierto(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <FormField label="Rutina (cliente)">
              <select
                value={idRutina}
                onChange={(e) => {
                  setIdRutina(e.target.value);
                  setEjercicios([]);
                }}
                required
                className={inputClass}
              >
                <option value="">Selecciona una rutina activa</option>
                {rutinas.map((r) => (
                  <option key={r.id_rutina} value={r.id_rutina}>
                    {r.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Ejercicio">
              <select name="id_rutina_ejercicio" required disabled={!idRutina} className={inputClass}>
                <option value="">Selecciona un ejercicio</option>
                {ejercicios.map((ej) => (
                  <option key={ej.id_rutina_ejercicio} value={ej.id_rutina_ejercicio}>
                    {ej.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha (vacío = hoy)">
              <input name="fecha" type="date" className={inputClass} />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Series realizadas">
                <input name="series_realizadas" type="number" min={0} className={inputClass} />
              </FormField>
              <FormField label="Repeticiones">
                <input name="repeticiones_realizadas" type="number" min={0} className={inputClass} />
              </FormField>
              <FormField label="Peso usado (kg)">
                <input name="peso_usado_kg" type="number" min={0} step="0.1" className={inputClass} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="completado" defaultChecked />
              Completado
            </label>
            <FormField label="Observaciones (opcional)">
              <textarea name="observaciones" rows={2} className={inputClass} />
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

      {editando && (
        <Modal titulo="Editar registro de cumplimiento" onClose={() => setEditando(null)}>
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Series realizadas">
                <input
                  name="series_realizadas"
                  type="number"
                  min={0}
                  defaultValue={editando.series_realizadas ?? ''}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Repeticiones">
                <input
                  name="repeticiones_realizadas"
                  type="number"
                  min={0}
                  defaultValue={editando.repeticiones_realizadas ?? ''}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Peso usado (kg)">
                <input
                  name="peso_usado_kg"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={editando.peso_usado_kg ?? ''}
                  className={inputClass}
                />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="completado" defaultChecked={editando.completado} />
              Completado
            </label>
            <FormField label="Observaciones (opcional)">
              <textarea name="observaciones" rows={2} defaultValue={editando.observaciones ?? ''} className={inputClass} />
            </FormField>

            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
