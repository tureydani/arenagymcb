import { NextResponse } from 'next/server';
import { RegistroCumplimiento } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'ENTRENADOR']);
  if (prohibido) return prohibido;

  const { id } = await params;
  const body = await request.json();
  const { series_realizadas, repeticiones_realizadas, peso_usado_kg, completado, observaciones } = body;

  const registro = await RegistroCumplimiento.findByPk(id);
  if (!registro) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  try {
    await registro.update({
      ...(series_realizadas !== undefined && { series_realizadas }),
      ...(repeticiones_realizadas !== undefined && { repeticiones_realizadas }),
      ...(peso_usado_kg !== undefined && { peso_usado_kg }),
      ...(completado !== undefined && { completado }),
      ...(observaciones !== undefined && { observaciones }),
    });
    return NextResponse.json(registro);
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo actualizar el registro');
  }
}
