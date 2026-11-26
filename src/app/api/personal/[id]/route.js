import { NextResponse } from 'next/server';
import { Personal } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';

export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN']);
  if (prohibido) return prohibido;

  const { id } = await params;
  const body = await request.json();
  const { nombre, apellido, telefono, roles, activo } = body;

  const personal = await Personal.findByPk(id);
  if (!personal) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await personal.update({
    ...(nombre !== undefined && { nombre }),
    ...(apellido !== undefined && { apellido }),
    ...(telefono !== undefined && { telefono }),
    ...(roles !== undefined && { roles }),
    ...(activo !== undefined && { activo }),
  });

  return NextResponse.json(personal);
}
