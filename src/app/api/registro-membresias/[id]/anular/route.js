import { NextResponse } from 'next/server';
import { RegistroMembresia } from '@/lib/db/models';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';

export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const { id } = await params;
  const { motivo } = await request.json();

  if (!motivo?.trim()) {
    return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 });
  }

  const registro = await RegistroMembresia.findByPk(id);
  if (!registro || registro.anulado) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await registro.update({
    anulado: true,
    motivo_anulacion: motivo,
    anulado_por: payload.id_personal,
    anulado_at: new Date(),
  });

  return NextResponse.json(registro);
}
