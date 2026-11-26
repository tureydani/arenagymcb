import { NextResponse } from 'next/server';
import { Membresia } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(Membresia, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    q: searchParams.get('q'),
    camposBusqueda: ['nombre'],
    order: [['precio', 'ASC']],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN']);
  if (prohibido) return prohibido;

  const body = await request.json();
  const { nombre, descripcion, duracion_dias, precio, limite_asistencias } = body;

  if (!nombre || !duracion_dias || precio === undefined) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  try {
    const membresia = await Membresia.create({
      nombre,
      descripcion,
      duracion_dias,
      precio,
      limite_asistencias: limite_asistencias || null,
      activo: true,
    });
    return NextResponse.json(membresia, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'Ya existe un plan con ese nombre');
  }
}
