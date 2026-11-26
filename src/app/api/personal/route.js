import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Personal } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(Personal, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    q: searchParams.get('q'),
    camposBusqueda: ['nombre', 'apellido', 'usuario'],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN']);
  if (prohibido) return prohibido;

  const body = await request.json();
  const { nombre, apellido, usuario, password, telefono, roles } = body;

  if (!nombre || !apellido || !usuario || !password || !roles?.length) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  try {
    const personal = await Personal.create({
      nombre,
      apellido,
      usuario,
      password_hash,
      telefono,
      roles,
      activo: true,
    });
    return NextResponse.json(personal, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'Ese usuario ya existe');
  }
}
