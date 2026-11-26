import { NextResponse } from 'next/server';
import { Rutina, RutinaEjercicio, Cliente, Personal, Maquina } from '@/lib/db/models';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';

export async function GET(request, { params }) {
  const { id } = await params;

  const rutina = await Rutina.findByPk(id, {
    include: [
      { model: Cliente, as: 'cliente', attributes: ['nombre', 'apellido', 'telefono'] },
      { model: Personal, as: 'entrenador', attributes: ['nombre', 'apellido'] },
      {
        model: RutinaEjercicio,
        as: 'ejercicios',
        include: [{ model: Maquina, as: 'maquina', attributes: ['nombre', 'grupo_muscular'] }],
      },
    ],
    order: [[{ model: RutinaEjercicio, as: 'ejercicios' }, 'dia', 'ASC'], [{ model: RutinaEjercicio, as: 'ejercicios' }, 'orden', 'ASC']],
  });

  if (!rutina) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  return NextResponse.json(rutina);
}

// Solo nombre/objetivo: son texto libre sin regla de negocio que los
// calcule (a diferencia de fecha_fin/precio en registro_membresias), así
// que corregirlos no debería exigir archivar y crear una rutina nueva. Los
// ejercicios no se editan aquí (se fijan al crear la rutina).
export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'ENTRENADOR']);
  if (prohibido) return prohibido;

  const { id } = await params;
  const body = await request.json();
  const { nombre, objetivo } = body;

  const rutina = await Rutina.findByPk(id);
  if (!rutina) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  if (nombre !== undefined && !nombre.trim()) {
    return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
  }

  await rutina.update({
    ...(nombre !== undefined && { nombre }),
    ...(objetivo !== undefined && { objetivo: objetivo || null }),
  });

  return NextResponse.json(rutina);
}
