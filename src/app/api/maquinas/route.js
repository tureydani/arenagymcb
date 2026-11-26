import { NextResponse } from 'next/server';
import { Maquina } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(Maquina, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    q: searchParams.get('q'),
    camposBusqueda: ['nombre', 'grupo_muscular'],
    order: [['nombre', 'ASC']],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  await verificarAuthPersonal(request);

  const body = await request.json();
  const { nombre, grupo_muscular, descripcion, imagen_url } = body;

  if (!nombre || !grupo_muscular) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  try {
    const maquina = await Maquina.create({
      nombre,
      grupo_muscular,
      descripcion: descripcion || null,
      imagen_url: imagen_url || null,
      operativa: true,
      activo: true,
    });
    return NextResponse.json(maquina, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'Ya existe una máquina con ese nombre');
  }
}
