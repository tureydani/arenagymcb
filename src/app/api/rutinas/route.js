import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import sequelize from '@/lib/db/sequelize';
import { Rutina, RutinaEjercicio, Cliente, Personal } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const estado = searchParams.get('estado');

  const resultado = await listarPaginado(Rutina, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    where: estado ? { estado } : {},
    order: [['created_at', 'DESC']],
    include: [
      {
        model: Cliente,
        as: 'cliente',
        attributes: ['nombre', 'apellido', 'telefono'],
        required: !!q,
        where: q
          ? {
              [Op.or]: [
                { nombre: { [Op.iLike]: `%${q}%` } },
                { apellido: { [Op.iLike]: `%${q}%` } },
              ],
            }
          : undefined,
      },
      { model: Personal, as: 'entrenador', attributes: ['nombre', 'apellido'] },
    ],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'ENTRENADOR']);
  if (prohibido) return prohibido;

  const body = await request.json();
  const { id_cliente, nombre, objetivo, fecha_inicio, ejercicios } = body;

  if (!id_cliente || !nombre?.trim()) {
    return NextResponse.json({ error: 'El cliente y el nombre de la rutina son obligatorios' }, { status: 400 });
  }
  if (!Array.isArray(ejercicios) || ejercicios.length === 0) {
    return NextResponse.json({ error: 'La rutina debe tener al menos un ejercicio' }, { status: 400 });
  }

  const combinaciones = new Set();
  for (const ej of ejercicios) {
    if (!ej.id_maquina || !ej.dia || !ej.orden || !ej.series || !ej.repeticiones) {
      return NextResponse.json(
        { error: 'Cada ejercicio necesita máquina, día, orden, series y repeticiones' },
        { status: 400 }
      );
    }
    if (ej.dia < 1 || ej.dia > 7) {
      return NextResponse.json({ error: 'El día debe estar entre 1 y 7' }, { status: 400 });
    }
    if (ej.series < 1 || ej.series > 10) {
      return NextResponse.json({ error: 'Las series deben estar entre 1 y 10' }, { status: 400 });
    }
    if (ej.repeticiones < 1 || ej.repeticiones > 100) {
      return NextResponse.json({ error: 'Las repeticiones deben estar entre 1 y 100' }, { status: 400 });
    }
    if (ej.descanso_seg !== undefined && ej.descanso_seg !== null && (ej.descanso_seg < 0 || ej.descanso_seg > 600)) {
      return NextResponse.json({ error: 'El descanso debe estar entre 0 y 600 segundos' }, { status: 400 });
    }
    const clave = `${ej.dia}-${ej.orden}`;
    if (combinaciones.has(clave)) {
      return NextResponse.json({ error: `Día ${ej.dia} tiene dos ejercicios con el mismo orden (${ej.orden})` }, { status: 400 });
    }
    combinaciones.add(clave);
  }

  try {
    const rutina = await sequelize.transaction(async (t) => {
      const rutinaCreada = await Rutina.create(
        {
          id_cliente,
          id_entrenador: payload.id_personal,
          nombre,
          objetivo: objetivo || null,
          origen: 'MANUAL',
          estado: 'ACTIVA',
          ...(fecha_inicio && { fecha_inicio }),
        },
        { transaction: t }
      );

      await RutinaEjercicio.bulkCreate(
        ejercicios.map((ej) => ({
          id_rutina: rutinaCreada.id_rutina,
          dia: ej.dia,
          orden: ej.orden,
          id_maquina: ej.id_maquina,
          ejercicio: ej.ejercicio || null,
          series: ej.series,
          repeticiones: ej.repeticiones,
          descanso_seg: ej.descanso_seg || null,
          notas: ej.notas || null,
        })),
        { transaction: t }
      );

      return rutinaCreada;
    });

    return NextResponse.json(rutina, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo crear la rutina (el cliente ya tiene una rutina activa)');
  }
}
