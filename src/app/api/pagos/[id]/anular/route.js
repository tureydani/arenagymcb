import { NextResponse } from 'next/server';
import { Pago } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';

export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN']);
  if (prohibido) return prohibido;

  const { id } = await params;
  const { motivo } = await request.json();

  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 });
  }

  const pago = await Pago.findByPk(id);
  if (!pago || pago.anulado) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await pago.update({
    anulado: true,
    motivo_anulacion: motivo,
    anulado_por: payload.id_personal,
    anulado_at: new Date(),
  });

  return NextResponse.json(pago);
}
