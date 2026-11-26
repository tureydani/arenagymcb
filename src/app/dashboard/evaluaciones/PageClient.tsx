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
import FormField, { inputClass } from '@/components/ui/FormField';

type Evaluacion = {
  id_evaluacion: number;
  fecha: string;
  peso_kg: string | null;
  altura_cm: string | null;
  pecho_cm: string | null;
  cintura_cm: string | null;
  cadera_cm: string | null;
  brazo_cm: string | null;
  muslo_cm: string | null;
  enfoque: string | null;
  dias_disponibles: number | null;
  minutos_por_sesion: number | null;
  cliente: { nombre: string; apellido: string; telefono: string };
  entrenador: { nombre: string; apellido: string };
};

type OpcionCliente = { id: number; nombre: string };

const ENFOQUES = [
  { value: 'HIPERTROFIA', label: 'Hipertrofia' },
  { value: 'FUERZA', label: 'Fuerza' },
  { value: 'PERDIDA_GRASA', label: 'Pérdida de grasa' },
  { value: 'SALUD_GENERAL', label: 'Salud general' },
  { value: 'OTRO', label: 'Otro' },
];

const MEDIDAS: { campo: keyof Evaluacion; etiqueta: string; unidad: string }[] = [
  { campo: 'peso_kg', etiqueta: 'Peso', unidad: 'kg' },
  { campo: 'altura_cm', etiqueta: 'Altura', unidad: 'cm' },
  { campo: 'pecho_cm', etiqueta: 'Pecho', unidad: 'cm' },
  { campo: 'cintura_cm', etiqueta: 'Cintura', unidad: 'cm' },
  { campo: 'cadera_cm', etiqueta: 'Cadera', unidad: 'cm' },
  { campo: 'brazo_cm', etiqueta: 'Brazo', unidad: 'cm' },
  { campo: 'muslo_cm', etiqueta: 'Muslo', unidad: 'cm' },
];

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

function formatearMedidas(e: Evaluacion): string {
  const partes = MEDIDAS.filter((m) => e[m.campo] != null).map(
    (m) => `${m.etiqueta} ${Number(e[m.campo]).toFixed(1)}${m.unidad}`
  );
  return partes.length > 0 ? partes.join(' · ') : '—';
}

export default function EvaluacionesPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear } = useCrudResource<Evaluacion>('evaluaciones');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
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

    const leerNumero = (campo: string) => {
      const valor = form.get(campo) as string;
      return valor ? Number(valor) : null;
    };

    try {
      await crear({
        id_cliente: Number(form.get('id_cliente')),
        peso_kg: leerNumero('peso_kg'),
        altura_cm: leerNumero('altura_cm'),
        pecho_cm: leerNumero('pecho_cm'),
        cintura_cm: leerNumero('cintura_cm'),
        cadera_cm: leerNumero('cadera_cm'),
        brazo_cm: leerNumero('brazo_cm'),
        muslo_cm: leerNumero('muslo_cm'),
        enfoque: (form.get('enfoque') as string) || null,
        dias_disponibles: leerNumero('dias_disponibles'),
        minutos_por_sesion: leerNumero('minutos_por_sesion'),
        restricciones: (form.get('restricciones') as string) || null,
        observaciones: (form.get('observaciones') as string) || null,
      });
      mostrar('Evaluación registrada');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Evaluacion>[] = [
    { key: 'fecha', header: 'Fecha', render: (e) => e.fecha },
    { key: 'cliente', header: 'Cliente', render: (e) => `${e.cliente.nombre} ${e.cliente.apellido}` },
    { key: 'entrenador', header: 'Entrenador', render: (e) => `${e.entrenador.nombre} ${e.entrenador.apellido}` },
    { key: 'medidas', header: 'Medidas', render: formatearMedidas },
    {
      key: 'enfoque',
      header: 'Enfoque',
      align: 'center',
      render: (e) => ENFOQUES.find((o) => o.value === e.enfoque)?.label ?? '—',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Evaluaciones</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} evaluaciones registradas</p>
        </div>
        <Button onClick={() => setModalAbierto(true)}>+ Registrar evaluación</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por cliente…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(e) => e.id_evaluacion}
          cargando={cargando}
          mensajeVacio="No hay evaluaciones registradas."
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar evaluación" onClose={() => setModalAbierto(false)} ancho="max-w-2xl">
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
            <p className="text-xs text-[var(--text-secondary)]">
              El cliente debe tener consentimiento informado vigente (pantalla de Clientes).
            </p>

            <span className="text-sm font-medium">Medidas (al menos una)</span>
            <div className="grid grid-cols-3 gap-3">
              {MEDIDAS.map((m) => (
                <FormField key={m.campo} label={`${m.etiqueta} (${m.unidad})`}>
                  <input name={m.campo} type="number" min={0} step="0.1" className={inputClass} />
                </FormField>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="Enfoque (opcional)">
                <select name="enfoque" className={inputClass} defaultValue="">
                  <option value="">Sin especificar</option>
                  {ENFOQUES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Días disponibles (1-7)">
                <input name="dias_disponibles" type="number" min={1} max={7} className={inputClass} />
              </FormField>
              <FormField label="Minutos por sesión (15-240)">
                <input name="minutos_por_sesion" type="number" min={15} max={240} className={inputClass} />
              </FormField>
            </div>

            <FormField label="Restricciones (opcional)">
              <textarea name="restricciones" rows={2} className={inputClass} />
            </FormField>
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
    </div>
  );
}
