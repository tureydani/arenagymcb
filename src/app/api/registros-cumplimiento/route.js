import { NextResponse } from 'next/server';
import { RegistroCumplimiento, RutinaEjercicio, Rutina, Cliente, Maquina } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const idRutina = searchParams.get('id_rutina');

  const resultado = await listarPaginado(RegistroCumplimiento, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    order: [['fecha', 'DESC']],
    include: [
      {
        model: RutinaEjercicio,
        as: 'ejercicio',
        attributes: ['dia', 'orden'],
        required: !!idRutina,
        where: idRutina ? { id_rutina: idRutina } : undefined,
        include: [
          { model: Maquina, as: 'maquina', attributes: ['nombre'] },
          { model: Rutina, as: 'rutina', attributes: ['id_rutina', 'nombre'], include: [{ model: Cliente, as: 'cliente', attributes: ['nombre', 'apellido'] }] },
        ],
      },
    ],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'ENTRENADOR']);
  if (prohibido) return prohibido;

  const body = await request.json();
  const { id_rutina_ejercicio, fecha, series_realizadas, repeticiones_realizadas, peso_usado_kg, completado, observaciones } = body;

  if (!id_rutina_ejercicio) {
    return NextResponse.json({ error: 'El ejercicio es obligatorio' }, { status: 400 });
  }

  const ejercicio = await RutinaEjercicio.findByPk(id_rutina_ejercicio);
  if (!ejercicio) {
    return NextResponse.json({ error: 'El ejercicio de rutina no existe' }, { status: 404 });
  }

  try {
    const registro = await RegistroCumplimiento.create({
      id_rutina_ejercicio,
      ...(fecha && { fecha }),
      series_realizadas: series_realizadas ?? null,
      repeticiones_realizadas: repeticiones_realizadas ?? null,
      peso_usado_kg: peso_usado_kg ?? null,
      completado: completado !== undefined ? completado : true,
      observaciones: observaciones || null,
    });
    return NextResponse.json(registro, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo registrar el cumplimiento');
  }
}
