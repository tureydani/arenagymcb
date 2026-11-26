import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import sequelize from '@/lib/db/sequelize';
import { Venta, DetalleVenta, Producto, Cliente, JornadaCaja } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';
import { CANALES_COBRO } from '@/lib/canalesCobro';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const idJornada = searchParams.get('id_jornada');

  const resultado = await listarPaginado(Venta, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    where: idJornada ? { id_jornada: idJornada } : {},
    order: [['fecha_venta', 'DESC']],
    include: [
      {
        model: Cliente,
        as: 'cliente',
        attributes: ['nombre', 'apellido', 'telefono'],
        required: !!q,
        where: q
          ? {
              [Op.or]: [
                { nombre: { [Op.iLike]: `%${q}%` } },
                { apellido: { [Op.iLike]: `%${q}%` } },
              ],
            }
          : undefined,
      },
    ],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { id_cliente, canal_cobro, items } = body;

  if (!CANALES_COBRO.includes(canal_cobro)) {
    return NextResponse.json({ error: 'Canal de cobro inválido' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'La venta debe tener al menos un producto' }, { status: 400 });
  }
  for (const item of items) {
    if (!item.id_producto || !item.cantidad || Number(item.cantidad) <= 0) {
      return NextResponse.json({ error: 'Cada ítem necesita un producto y una cantidad mayor a 0' }, { status: 400 });
    }
  }

  const jornadaAbierta = await JornadaCaja.findOne({ where: { estado: 'ABIERTA' } });
  if (!jornadaAbierta) {
    return NextResponse.json({ error: 'No hay una jornada de caja abierta' }, { status: 409 });
  }

  try {
    const venta = await sequelize.transaction(async (t) => {
      let total = 0;
      const detallesAInsertar = [];

      for (const item of items) {
        const producto = await Producto.findByPk(item.id_producto, { transaction: t, lock: t.LOCK.UPDATE });
        if (!producto || !producto.activo) {
          throw new ErrorNegocio(`El producto ${item.id_producto} no existe o está inactivo`);
        }
        const cantidad = Number(item.cantidad);
        if (producto.stock < cantidad) {
          throw new ErrorNegocio(`Stock insuficiente de "${producto.nombre}" (disponible: ${producto.stock})`);
        }

        const esMayoreo = Boolean(producto.cantidad_mayoreo && cantidad >= producto.cantidad_mayoreo);
        const precioUnitario = esMayoreo ? producto.precio_mayoreo : producto.precio;
        total += Number(precioUnitario) * cantidad;

        await producto.update({ stock: producto.stock - cantidad }, { transaction: t });

        detallesAInsertar.push({
          id_producto: producto.id_producto,
          cantidad,
          precio_unitario: precioUnitario,
          es_mayoreo: esMayoreo,
        });
      }

      const ventaCreada = await Venta.create(
        {
          id_jornada: jornadaAbierta.id_jornada,
          id_cliente: id_cliente || null,
          canal_cobro,
          total,
          id_personal: payload.id_personal,
          anulado: false,
        },
        { transaction: t }
      );

      await DetalleVenta.bulkCreate(
        detallesAInsertar.map((d) => ({ ...d, id_venta: ventaCreada.id_venta })),
        { transaction: t }
      );

      return ventaCreada;
    });

    return NextResponse.json(venta, { status: 201 });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return respuestaErrorDb(err, 'No se pudo registrar la venta');
  }
}

class ErrorNegocio extends Error {}
