import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

function validarMayoreo({ precio, precio_mayoreo, cantidad_mayoreo }) {
  const hayMayoreo = precio_mayoreo !== null && precio_mayoreo !== undefined;
  const hayCantidad = cantidad_mayoreo !== null && cantidad_mayoreo !== undefined;
  if (hayMayoreo !== hayCantidad) {
    return 'El precio y la cantidad de mayoreo deben indicarse juntos';
  }
  if (hayCantidad && Number(cantidad_mayoreo) < 2) {
    return 'La cantidad de mayoreo debe ser al menos 2';
  }
  if (hayMayoreo && Number(precio_mayoreo) >= Number(precio)) {
    return 'El precio de mayoreo debe ser menor al precio normal';
  }
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(Producto, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    q: searchParams.get('q'),
    camposBusqueda: ['nombre'],
    order: [['nombre', 'ASC']],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  await verificarAuthPersonal(request);

  const body = await request.json();
  const { nombre, precio, stock, precio_mayoreo, cantidad_mayoreo } = body;

  if (!nombre || precio === undefined || precio === null) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }
  if (Number(precio) < 0) {
    return NextResponse.json({ error: 'El precio no puede ser negativo' }, { status: 400 });
  }

  const errorMayoreo = validarMayoreo({ precio, precio_mayoreo, cantidad_mayoreo });
  if (errorMayoreo) {
    return NextResponse.json({ error: errorMayoreo }, { status: 400 });
  }

  try {
    const producto = await Producto.create({
      nombre,
      precio,
      stock: stock || 0,
      precio_mayoreo: precio_mayoreo || null,
      cantidad_mayoreo: cantidad_mayoreo || null,
      activo: true,
    });
    return NextResponse.json(producto, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'Ya existe un producto con ese nombre');
  }
}
