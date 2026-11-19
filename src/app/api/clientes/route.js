import { NextResponse } from 'next/server';
import { Cliente } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';

function esMayorDeEdad(fechaNacimiento) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  const edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumplio =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  return aunNoCumplio ? edad - 1 >= 18 : edad >= 18;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(Cliente, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    q: searchParams.get('q'),
    camposBusqueda: ['nombre', 'apellido', 'telefono'],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { nombre, apellido, telefono, email, fecha_nacimiento } = body;

  if (!nombre || !apellido || !telefono || !fecha_nacimiento) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  if (!esMayorDeEdad(fecha_nacimiento)) {
    return NextResponse.json({ error: 'El cliente debe ser mayor de edad' }, { status: 400 });
  }

  try {
    const cliente = await Cliente.create({
      nombre,
      apellido,
      telefono,
      email: email || null,
      fecha_nacimiento,
      activo: true,
      registrado_por: payload.id_personal,
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({ error: 'Ya existe un cliente activo con ese teléfono o email' }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo crear el cliente' }, { status: 500 });
  }
}
