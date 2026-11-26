import { NextResponse } from 'next/server';
import { Meta } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

const ESTADOS = ['ACTIVA', 'CUMPLIDA', 'CANCELADA'];

export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'ENTRENADOR']);
  if (prohibido) return prohibido;

  const { id } = await params;
  const body = await request.json();
  const { valor_actual, estado } = body;

  const meta = await Meta.findByPk(id);
  if (!meta) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  if (valor_actual !== undefined && Number(valor_actual) <= 0) {
    return NextResponse.json({ error: 'El valor actual debe ser mayor a 0' }, { status: 400 });
  }
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  try {
    await meta.update({
      ...(valor_actual !== undefined && { valor_actual }),
      ...(estado !== undefined && { estado }),
    });
    return NextResponse.json(meta);
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo actualizar la meta');
  }
}
