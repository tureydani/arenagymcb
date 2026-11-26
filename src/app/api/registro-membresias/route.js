import { NextResponse } from 'next/server';
import { RegistroMembresia, VMembresiasVigentes } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(VMembresiasVigentes, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    q: searchParams.get('q'),
    camposBusqueda: ['nombre', 'apellido', 'telefono'],
    order: [['fecha_fin', 'ASC']],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { id_cliente, id_membresia, fecha_inicio } = body;

  if (!id_cliente || !id_membresia) {
    return NextResponse.json({ error: 'Cliente y plan son obligatorios' }, { status: 400 });
  }

  try {
    // fecha_fin, precio y limite_asistencias los completa el trigger
    // fn_registro_membresia_snapshot al insertar.
    const registro = await RegistroMembresia.create({
      id_cliente,
      id_membresia,
      ...(fecha_inicio && { fecha_inicio }),
      registrado_por: payload.id_personal,
    });
    return NextResponse.json(registro, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo registrar la membresía');
  }
}
