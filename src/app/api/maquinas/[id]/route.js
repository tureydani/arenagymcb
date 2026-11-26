import { NextResponse } from 'next/server';
import { Maquina } from '@/lib/db/models';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function PATCH(request, { params }) {
  await verificarAuthPersonal(request);

  const { id } = await params;
  const body = await request.json();
  const { nombre, grupo_muscular, descripcion, imagen_url, operativa, activo } = body;

  const maquina = await Maquina.findByPk(id);
  if (!maquina) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  try {
    await maquina.update({
      ...(nombre !== undefined && { nombre }),
      ...(grupo_muscular !== undefined && { grupo_muscular }),
      ...(descripcion !== undefined && { descripcion }),
      ...(imagen_url !== undefined && { imagen_url }),
      ...(operativa !== undefined && { operativa }),
      ...(activo !== undefined && { activo }),
    });
    return NextResponse.json(maquina);
  } catch (err) {
    return respuestaErrorDb(err, 'Ya existe una máquina con ese nombre');
  }
}
