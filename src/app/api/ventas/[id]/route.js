import { NextResponse } from 'next/server';
import { Venta, DetalleVenta, Producto, Cliente } from '@/lib/db/models';

// Detalle de una venta (líneas + producto). Se pide aparte del listado para
// no forzar un join hasMany en la página paginada de ventas.
export async function GET(request, { params }) {
  const { id } = await params;

  const venta = await Venta.findByPk(id, {
    include: [
      { model: Cliente, as: 'cliente', attributes: ['nombre', 'apellido', 'telefono'] },
      {
        model: DetalleVenta,
        as: 'detalles',
        include: [{ model: Producto, as: 'producto', attributes: ['nombre'] }],
      },
    ],
  });

  if (!venta) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  return NextResponse.json(venta);
}
