import { NextResponse } from 'next/server';
import { Producto } from '@/lib/db/models';
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

export async function PATCH(request, { params }) {
  await verificarAuthPersonal(request);

  const { id } = await params;
  const body = await request.json();
  const { nombre, precio, stock, precio_mayoreo, cantidad_mayoreo, activo } = body;

  const producto = await Producto.findByPk(id);
  if (!producto) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const precioFinal = precio !== undefined ? precio : producto.precio;
  const mayoreoFinal = precio_mayoreo !== undefined ? precio_mayoreo : producto.precio_mayoreo;
  const cantidadFinal = cantidad_mayoreo !== undefined ? cantidad_mayoreo : producto.cantidad_mayoreo;

  if (precio !== undefined && Number(precio) < 0) {
    return NextResponse.json({ error: 'El precio no puede ser negativo' }, { status: 400 });
  }

  const errorMayoreo = validarMayoreo({
    precio: precioFinal,
    precio_mayoreo: mayoreoFinal,
    cantidad_mayoreo: cantidadFinal,
  });
  if (errorMayoreo) {
    return NextResponse.json({ error: errorMayoreo }, { status: 400 });
  }

  try {
    await producto.update({
      ...(nombre !== undefined && { nombre }),
      ...(precio !== undefined && { precio }),
      ...(stock !== undefined && { stock }),
      ...(precio_mayoreo !== undefined && { precio_mayoreo }),
      ...(cantidad_mayoreo !== undefined && { cantidad_mayoreo }),
      ...(activo !== undefined && { activo }),
    });
    return NextResponse.json(producto);
  } catch (err) {
    return respuestaErrorDb(err, 'Ya existe un producto con ese nombre');
  }
}
