'use client';

import { useEffect, useState } from 'react';
import api from '@/utils/api';
import { useCrudResource } from '@/hooks/useCrudResource';
import { useToast } from '@/components/ui/Toast';
import DataTable, { Columna } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FormField, { inputClass } from '@/components/ui/FormField';
import RowActionButton from '@/components/ui/RowActionButton';
import { IconBan, IconEye } from '@/components/ui/icons';
import { CANALES_COBRO } from '@/lib/canalesCobro';

type Venta = {
  id_venta: number;
  canal_cobro: string;
  total: string;
  fecha_venta: string;
  anulado: boolean;
  cliente: { nombre: string; apellido: string } | null;
};

type DetalleVentaDTO = {
  id_detalle: number;
  cantidad: number;
  precio_unitario: string;
  es_mayoreo: boolean;
  subtotal: string;
  producto: { nombre: string };
};

type VentaDetalle = Venta & { detalles: DetalleVentaDTO[] };

type OpcionCliente = { id: number; nombre: string };

type ProductoVenta = {
  id_producto: number;
  nombre: string;
  precio: string;
  precio_mayoreo: string | null;
  cantidad_mayoreo: number | null;
  stock: number;
  activo: boolean;
};

type ItemForm = { id_producto: number; cantidad: number };

function mensajeError(err: unknown): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Ocurrió un error';
}

function precioParaCantidad(producto: ProductoVenta, cantidad: number): number {
  const aplicaMayoreo = producto.cantidad_mayoreo != null && cantidad >= producto.cantidad_mayoreo;
  return Number(aplicaMayoreo ? producto.precio_mayoreo : producto.precio);
}

export default function VentasPage() {
  const { filas, total, page, limit, cargando, setPage, crear, cerrar } = useCrudResource<Venta>('ventas');
  const { mostrar } = useToast();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [anulando, setAnulando] = useState<Venta | null>(null);
  const [viendoDetalle, setViendoDetalle] = useState<VentaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [clientes, setClientes] = useState<OpcionCliente[]>([]);
  const [productos, setProductos] = useState<ProductoVenta[]>([]);
  const [canalCobro, setCanalCobro] = useState('');
  const [idCliente, setIdCliente] = useState('');
  const [items, setItems] = useState<ItemForm[]>([{ id_producto: 0, cantidad: 1 }]);

  function abrirModal() {
    setCanalCobro('');
    setIdCliente('');
    setItems([{ id_producto: 0, cantidad: 1 }]);
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
    api.get('/productos', { params: { limit: 100 } }).then(({ data }) =>
      setProductos(data.data.filter((p: ProductoVenta) => p.activo))
    );
  }, [modalAbierto]);

  function actualizarItem(indice: number, cambios: Partial<ItemForm>) {
    setItems((actuales) => actuales.map((it, i) => (i === indice ? { ...it, ...cambios } : it)));
  }

  function agregarFila() {
    setItems((actuales) => [...actuales, { id_producto: 0, cantidad: 1 }]);
  }

  function quitarFila(indice: number) {
    setItems((actuales) => actuales.filter((_, i) => i !== indice));
  }

  const totalPreview = items.reduce((acc, it) => {
    const producto = productos.find((p) => p.id_producto === it.id_producto);
    if (!producto || it.cantidad <= 0) return acc;
    return acc + precioParaCantidad(producto, it.cantidad) * it.cantidad;
  }, 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const itemsValidos = items.filter((it) => it.id_producto > 0 && it.cantidad > 0);
    if (itemsValidos.length === 0) {
      mostrar('Agrega al menos un producto con cantidad válida', 'error');
      return;
    }
    if (!canalCobro) {
      mostrar('Selecciona un canal de cobro', 'error');
      return;
    }

    try {
      await crear({
        id_cliente: idCliente ? Number(idCliente) : null,
        canal_cobro: canalCobro,
        items: itemsValidos,
      });
      mostrar('Venta registrada');
      setModalAbierto(false);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  async function verDetalle(venta: Venta) {
    setCargandoDetalle(true);
    try {
      const { data } = await api.get(`/ventas/${venta.id_venta}`);
      setViendoDetalle(data);
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function anular(motivo?: string) {
    if (!anulando) return;
    try {
      await cerrar(anulando.id_venta, { motivo });
      mostrar('Venta anulada (stock repuesto)');
    } catch (err) {
      mostrar(mensajeError(err), 'error');
    }
  }

  const columnas: Columna<Venta>[] = [
    { key: 'fecha', header: 'Fecha', render: (v) => new Date(v.fecha_venta).toLocaleString('es-BO') },
    { key: 'cliente', header: 'Cliente', render: (v) => (v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : 'Venta al paso') },
    { key: 'canal', header: 'Canal', render: (v) => v.canal_cobro },
    { key: 'total', header: 'Total (Bs)', align: 'right', render: (v) => Number(v.total).toFixed(2) },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      render: (v) => (v.anulado ? <span className="text-[var(--danger)]">Anulado</span> : 'Vigente'),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold">Ventas</h1>
          <p className="text-sm text-[var(--text-secondary)]">{total} ventas registradas</p>
        </div>
        <Button onClick={abrirModal}>+ Registrar venta</Button>
      </div>

      <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)]">
        <DataTable
          columnas={columnas}
          filas={filas}
          idKey={(v) => v.id_venta}
          cargando={cargando}
          mensajeVacio="No hay ventas registradas."
          acciones={(v) => (
            <>
              <RowActionButton titulo="Ver detalle" onClick={() => verDetalle(v)}>
                <IconEye />
              </RowActionButton>
              {!v.anulado && (
                <RowActionButton titulo="Anular" tono="danger" onClick={() => setAnulando(v)}>
                  <IconBan />
                </RowActionButton>
              )}
            </>
          )}
        />
        <Pagination page={page} limit={limit} total={total} onPageChange={setPage} />
      </div>

      {modalAbierto && (
        <Modal titulo="Registrar venta" onClose={() => setModalAbierto(false)} ancho="max-w-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cliente (opcional)">
                <select
                  value={idCliente}
                  onChange={(e) => setIdCliente(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Venta al paso (sin cliente)</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Canal de cobro">
                <select
                  value={canalCobro}
                  onChange={(e) => setCanalCobro(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Selecciona un canal</option>
                  {CANALES_COBRO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Productos</span>
              {items.map((item, indice) => {
                const producto = productos.find((p) => p.id_producto === item.id_producto);
                const precio = producto ? precioParaCantidad(producto, item.cantidad) : 0;
                return (
                  <div key={indice} className="flex items-center gap-2">
                    <select
                      value={item.id_producto}
                      onChange={(e) => actualizarItem(indice, { id_producto: Number(e.target.value) })}
                      className={`${inputClass} flex-1`}
                    >
                      <option value={0}>Selecciona un producto</option>
                      {productos.map((p) => (
                        <option key={p.id_producto} value={p.id_producto}>
                          {p.nombre} — Bs {Number(p.precio).toFixed(2)}
                          {p.cantidad_mayoreo ? ` (mayoreo desde ${p.cantidad_mayoreo}: Bs ${Number(p.precio_mayoreo).toFixed(2)})` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={item.cantidad}
                      onChange={(e) => actualizarItem(indice, { cantidad: Number(e.target.value) })}
                      className={`${inputClass} w-20`}
                    />
                    <span className="w-20 text-right text-sm text-[var(--text-secondary)]">
                      {producto ? `Bs ${(precio * item.cantidad).toFixed(2)}` : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarFila(indice)}
                      disabled={items.length === 1}
                      className="text-[var(--danger)] disabled:opacity-30"
                      title="Quitar"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <Button variante="secondary" onClick={agregarFila}>
                + Agregar producto
              </Button>
            </div>

            <p className="text-right text-sm font-medium">
              Total estimado: Bs {totalPreview.toFixed(2)}
              <span className="ml-1 text-xs font-normal text-[var(--text-secondary)]">
                (el servidor recalcula el total y el precio real)
              </span>
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

      {viendoDetalle && (
        <Modal titulo={`Detalle de venta #${viendoDetalle.id_venta}`} onClose={() => setViendoDetalle(null)}>
          {cargandoDetalle ? (
            <p className="text-sm text-[var(--text-secondary)]">Cargando…</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Cliente:{' '}
                {viendoDetalle.cliente ? `${viendoDetalle.cliente.nombre} ${viendoDetalle.cliente.apellido}` : 'Venta al paso'}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-left text-[var(--text-secondary)]">
                    <th className="py-2">Producto</th>
                    <th className="py-2 text-center">Cant.</th>
                    <th className="py-2 text-right">Precio</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viendoDetalle.detalles.map((d) => (
                    <tr key={d.id_detalle} className="border-b border-[var(--surface-border)] last:border-0">
                      <td className="py-2">
                        {d.producto.nombre}
                        {d.es_mayoreo && <span className="ml-1 text-xs text-[var(--accent)]">(mayoreo)</span>}
                      </td>
                      <td className="py-2 text-center">{d.cantidad}</td>
                      <td className="py-2 text-right">{Number(d.precio_unitario).toFixed(2)}</td>
                      <td className="py-2 text-right">{Number(d.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-right font-medium">Total: Bs {Number(viendoDetalle.total).toFixed(2)}</p>
            </div>
          )}
        </Modal>
      )}

      {anulando && (
        <ConfirmDialog
          titulo="Anular venta"
          descripcion={`Vas a anular la venta de Bs ${Number(anulando.total).toFixed(2)}. El stock de los productos se repondrá. Esta acción queda registrada en auditoría.`}
          pedirMotivo
          onConfirm={anular}
          onClose={() => setAnulando(null)}
        />
      )}
    </div>
  );
}
