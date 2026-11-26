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
import { IconBan, IconEye, IconPencil } from '@/components/ui/icons';

type Rutina = {
  id_rutina: number;
  nombre: string;
  objetivo: string | null;
  estado: 'ACTIVA' | 'ARCHIVADA';
  fecha_inicio: string;
  fecha_fin: string | null;
  cliente: { nombre: string; apellido: string; telefono: string };
  entrenador: { nombre: string; apellido: string };
};

type EjercicioDTO = {
  id_rutina_ejercicio: number;
  dia: number;
  orden: number;
  ejercicio: string | null;
  series: number;
  repeticiones: number;
  descanso_seg: number | null;
  notas: string | null;
  maquina: { nombre: string; grupo_muscular: string };
};

type RutinaDetalle = Rutina & { ejercicios: EjercicioDTO[] };

type OpcionCliente = { id: number; nombre: string };
type OpcionMaquina = { id_maquina: number; nombre: string };

type ItemForm = {
  dia: number;
  orden: number;
  id_maquina: number;
  ejercicio: string;
  series: number;
  repeticiones: number;
  descanso_seg: number | '';
  notas: string;
};

const DIAS = [1, 2, 3, 4, 5, 6, 7];
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

function itemVacio(orden: number): ItemForm {
  return { dia: 1, orden, id_maquina: 0, ejercicio: '', series: 3, repeticiones: 12, descanso_seg: '', notas: '' };
}

export default function RutinasPage() {
  const { filas, total, page, limit, q, cargando, setPage, buscar, crear, actualizar, recargar } =
    useCrudResource<Rutina>('rutinas');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [archivando, setArchivando] = useState<Rutina | null>(null);
  const [editando, setEditando] = useState<Rutina | null>(null);
  const [viendoDetalle, setViendoDetalle] = useState<RutinaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [clientes, setClientes] = useState<OpcionCliente[]>([]);
  const [maquinas, setMaquinas] = useState<OpcionMaquina[]>([]);
  const [idCliente, setIdCliente] = useState('');
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [items, setItems] = useState<ItemForm[]>([itemVacio(1)]);

  function abrirModal() {
    setIdCliente('');
    setNombre('');
    setObjetivo('');
    setItems([itemVacio(1)]);
    setModalAbierto(true);
  }

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
    api.get('/maquinas', { params: { limit: 100 } }).then(({ data }) =>
      setMaquinas(
        data.data
          .filter((m: { activo: boolean }) => m.activo)
          .map((m: { id_maquina: number; nombre: string }) => ({ id_maquina: m.id_maquina, nombre: m.nombre }))
      )
    );
  }, [modalAbierto]);

  function actualizarItem(indice: number, cambios: Partial<ItemForm>) {
    setItems((actuales) => actuales.map((it, i) => (i === indice ? { ...it, ...cambios } : it)));
  }

  function agregarFila() {
    setItems((actuales) => [...actuales, itemVacio(actuales.length + 1)]);
  }

  function quitarFila(indice: number) {
    setItems((actuales) => actuales.filter((_, i) => i !== indice));
  }

  function validarItems(): string | null {
    const claves = new Set<string>();
    for (const it of items) {
      if (!it.id_maquina) return 'Selecciona una máquina en cada ejercicio';
      const clave = `${it.dia}-${it.orden}`;
      if (claves.has(clave)) return `Hay dos ejercicios con el mismo día y orden (día ${it.dia}, orden ${it.orden})`;
      claves.add(clave);
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errorItems = validarItems();
    if (errorItems) {
      mostrar(errorItems, 'error');
      return;
    }

    try {
      await crear({
        id_cliente: Number(idCliente),
        nombre,
        objetivo: objetivo || null,
        ejercicios: items.map((it) => ({
          dia: it.dia,
          orden: it.orden,
          id_maquina: it.id_maquina,
          ejercicio: it.ejercicio || null,
          series: it.series,
          repeticiones: it.repeticiones,
          descanso_seg: it.descanso_seg === '' ? null : it.descanso_seg,
          notas: it.notas || null,
        })),
      });
      mostrar('Rutina creada');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function verDetalle(rutina: Rutina) {
    setCargandoDetalle(true);
    try {
      const { data } = await api.get(`/rutinas/${rutina.id_rutina}`);
      setViendoDetalle(data);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function archivar() {
    if (!archivando) return;
    try {
      await api.patch(`/rutinas/${archivando.id_rutina}/archivar`);
      await recargar();
      mostrar('Rutina archivada');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function guardarEdicion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editando) return;
    const form = new FormData(e.currentTarget);
    try {
      await actualizar(editando.id_rutina, {
        nombre: form.get('nombre') as string,
        objetivo: (form.get('objetivo') as string) || null,
      });
      mostrar('Rutina actualizada');
      setEditando(null);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Rutina>[] = [
    { key: 'cliente', header: 'Cliente', render: (r) => `${r.cliente.nombre} ${r.cliente.apellido}` },
    { key: 'nombre', header: 'Rutina', render: (r) => r.nombre },
    { key: 'entrenador', header: 'Entrenador', render: (r) => `${r.entrenador.nombre} ${r.entrenador.apellido}` },
    { key: 'inicio', header: 'Inicio', render: (r) => r.fecha_inicio },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            r.estado === 'ACTIVA' ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--surface-border)] text-[var(--text-secondary)]'
          }`}
        >
          {r.estado === 'ACTIVA' ? 'Activa' : 'Archivada'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Rutinas</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} rutinas</p>
        </div>
        <Button onClick={abrirModal}>+ Asignar rutina</Button>
      </div>

      <div className="mt-4">
        <SearchBar value={q} onChange={buscar} placeholder="Buscar por cliente…" />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(r) => r.id_rutina}
          cargando={cargando}
          mensajeVacio="No hay rutinas asignadas."
          acciones={(r) => (
            <>
              <RowActionButton titulo="Ver detalle" onClick={() => verDetalle(r)}>
                <IconEye />
              </RowActionButton>
              <RowActionButton titulo="Editar nombre/objetivo" onClick={() => setEditando(r)}>
                <IconPencil />
              </RowActionButton>
              {r.estado === 'ACTIVA' && (
                <RowActionButton titulo="Archivar" tono="danger" onClick={() => setArchivando(r)}>
                  <IconBan />
                </RowActionButton>
              )}
            </>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Asignar rutina" onClose={() => setModalAbierto(false)} ancho="max-w-3xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cliente">
                <select value={idCliente} onChange={(e) => setIdCliente(e.target.value)} required className={inputClass}>
                  <option value="">Selecciona un cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Nombre de la rutina">
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className={inputClass} />
              </FormField>
            </div>
            <FormField label="Objetivo (opcional)">
              <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={inputClass} />
            </FormField>
            <p className="text-xs text-[var(--text-secondary)]">
              Solo puede haber una rutina activa por cliente a la vez.
            </p>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Ejercicios</span>
              {items.map((item, indice) => (
                <div key={indice} className="grid grid-cols-12 items-end gap-1 rounded-md border border-[var(--surface-border)] p-2">
                  <select
                    value={item.dia}
                    onChange={(e) => actualizarItem(indice, { dia: Number(e.target.value) })}
                    className={`${inputClass} col-span-2`}
                  >
                    {DIAS.map((d) => (
                      <option key={d} value={d}>
                        {DIAS_LABEL[d]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.orden}
                    onChange={(e) => actualizarItem(indice, { orden: Number(e.target.value) })}
                    title="Orden"
                    className={`${inputClass} col-span-1`}
                  />
                  <select
                    value={item.id_maquina}
                    onChange={(e) => actualizarItem(indice, { id_maquina: Number(e.target.value) })}
                    className={`${inputClass} col-span-4`}
                  >
                    <option value={0}>Máquina</option>
                    {maquinas.map((m) => (
                      <option key={m.id_maquina} value={m.id_maquina}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={item.series}
                    onChange={(e) => actualizarItem(indice, { series: Number(e.target.value) })}
                    title="Series"
                    className={`${inputClass} col-span-1`}
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={item.repeticiones}
                    onChange={(e) => actualizarItem(indice, { repeticiones: Number(e.target.value) })}
                    title="Repeticiones"
                    className={`${inputClass} col-span-2`}
                  />
                  <input
                    type="number"
                    min={0}
                    max={600}
                    placeholder="Descanso (s)"
                    value={item.descanso_seg}
                    onChange={(e) =>
                      actualizarItem(indice, { descanso_seg: e.target.value === '' ? '' : Number(e.target.value) })
                    }
                    className={`${inputClass} col-span-1`}
                  />
                  <button
                    type="button"
                    onClick={() => quitarFila(indice)}
                    disabled={items.length === 1}
                    className="col-span-1 text-[var(--danger)] disabled:opacity-30"
                    title="Quitar"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <Button variante="secondary" onClick={agregarFila}>
                + Agregar ejercicio
              </Button>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear rutina</Button>
            </div>
          </form>
        </Modal>
      )}

      {viendoDetalle && (
        <Modal titulo={`Rutina: ${viendoDetalle.nombre}`} onClose={() => setViendoDetalle(null)} ancho="max-w-2xl">
          {cargandoDetalle ? (
            <p className="text-sm text-[var(--text-secondary)]">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Cliente: {viendoDetalle.cliente.nombre} {viendoDetalle.cliente.apellido} · Entrenador:{' '}
                {viendoDetalle.entrenador.nombre} {viendoDetalle.entrenador.apellido}
              </p>
              {DIAS.filter((d) => viendoDetalle.ejercicios.some((ej) => ej.dia === d)).map((dia) => (
                <div key={dia}>
                  <p className="text-sm font-medium">{DIAS_LABEL[dia]}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-left text-[var(--text-secondary)]">
                        <th className="py-1">Máquina</th>
                        <th className="py-1 text-center">Series</th>
                        <th className="py-1 text-center">Reps</th>
                        <th className="py-1 text-center">Descanso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viendoDetalle.ejercicios
                        .filter((ej) => ej.dia === dia)
                        .sort((a, b) => a.orden - b.orden)
                        .map((ej) => (
                          <tr key={ej.id_rutina_ejercicio} className="border-b border-[var(--surface-border)] last:border-0">
                            <td className="py-1">{ej.ejercicio || ej.maquina.nombre}</td>
                            <td className="py-1 text-center">{ej.series}</td>
                            <td className="py-1 text-center">{ej.repeticiones}</td>
                            <td className="py-1 text-center">{ej.descanso_seg ? `${ej.descanso_seg}s` : '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {editando && (
        <Modal titulo="Editar rutina" onClose={() => setEditando(null)} ancho="max-w-md">
          <form onSubmit={guardarEdicion} className="flex flex-col gap-3">
            <FormField label="Nombre de la rutina">
              <input name="nombre" required defaultValue={editando.nombre} className={inputClass} />
            </FormField>
            <FormField label="Objetivo (opcional)">
              <input name="objetivo" defaultValue={editando.objetivo ?? ''} className={inputClass} />
            </FormField>
            <p className="text-xs text-[var(--text-secondary)]">
              Los ejercicios no se editan aquí; archiva la rutina y crea una nueva si necesitas cambiarlos.
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <Button variante="secondary" onClick={() => setEditando(null)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Modal>
      )}

      {archivando && (
        <ConfirmDialog
          titulo="Archivar rutina"
          descripcion={`¿Confirmas archivar la rutina "${archivando.nombre}" de ${archivando.cliente.nombre} ${archivando.cliente.apellido}? Podrás asignarle una nueva rutina después.`}
          tono="warning"
          onConfirm={archivar}
          onClose={() => setArchivando(null)}
        />
      )}
    </div>
  );
}
