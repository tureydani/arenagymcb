import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, descripcion, duracion_dias, precio, limite_asistencias, activo } = body;

  const membresia = await Membresia.findByPk(id);
  if (!membresia) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await membresia.update({
    ...(nombre !== undefined && { nombre }),
    ...(descripcion !== undefined && { descripcion }),
    ...(duracion_dias !== undefined && { duracion_dias }),
    ...(precio !== undefined && { precio }),
    ...(limite_asistencias !== undefined && { limite_asistencias }),
    ...(activo !== undefined && { activo }),
  });

  return NextResponse.json(membresia);
}
