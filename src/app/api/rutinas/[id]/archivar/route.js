import { NextResponse } from 'next/server';
import { Rutina } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';

// Archivar cierra la rutina (no hay "anular": no es dinero/asistencia, es
// el fin natural del ciclo de vida). Libera el slot único de "una rutina
// ACTIVA por cliente" para poder asignar una nueva.
export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'ENTRENADOR']);
  if (prohibido) return prohibido;

  const { id } = await params;

  const rutina = await Rutina.findByPk(id);
  if (!rutina || rutina.estado !== 'ACTIVA') {
    return NextResponse.json({ error: 'No encontrado o ya archivada' }, { status: 404 });
  }

  await rutina.update({
    estado: 'ARCHIVADA',
    fecha_fin: rutina.fecha_fin || new Date().toISOString().slice(0, 10),
  });

  return NextResponse.json(rutina);
}
