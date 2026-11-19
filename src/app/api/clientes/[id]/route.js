import { NextResponse } from 'next/server';
import { Cliente } from '@/lib/db/models';

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, apellido, telefono, email, fecha_nacimiento, activo } = body;

  const cliente = await Cliente.findByPk(id);
  if (!cliente) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  await cliente.update({
    ...(nombre !== undefined && { nombre }),
    ...(apellido !== undefined && { apellido }),
    ...(telefono !== undefined && { telefono }),
    ...(email !== undefined && { email }),
    ...(fecha_nacimiento !== undefined && { fecha_nacimiento }),
    ...(activo !== undefined && { activo }),
  });

  return NextResponse.json(cliente);
}
