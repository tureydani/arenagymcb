import { NextResponse } from 'next/server';
import sequelize from '@/lib/db/sequelize';
import { Venta, DetalleVenta, Producto } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';

// Anular una venta repone el stock de cada línea: la venta descontó stock al
// crearse (la API lo decide, no hay trigger para esto, ver
// arena_gym_schema.sql sección 4), así que revertirla debe devolverlo.
export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN']);
  if (prohibido) return prohibido;

  const { id } = await params;
  const { motivo } = await request.json();

  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 });
  }

  const venta = await Venta.findByPk(id);
  if (!venta || venta.anulado) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await sequelize.transaction(async (t) => {
    const detalles = await DetalleVenta.findAll({ where: { id_venta: id }, transaction: t });
    for (const detalle of detalles) {
      const producto = await Producto.findByPk(detalle.id_producto, { transaction: t, lock: t.LOCK.UPDATE });
      if (producto) {
        await producto.update({ stock: producto.stock + detalle.cantidad }, { transaction: t });
      }
    }

    await venta.update(
      {
        anulado: true,
        motivo_anulacion: motivo,
        anulado_por: payload.id_personal,
        anulado_at: new Date(),
      },
      { transaction: t }
    );
  });

  return NextResponse.json(venta);
}
