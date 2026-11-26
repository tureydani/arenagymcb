import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Evaluacion, Cliente, Personal } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

const ENFOQUES = ['HIPERTROFIA', 'FUERZA', 'PERDIDA_GRASA', 'SALUD_GENERAL', 'OTRO'];
const MEDIDAS = ['peso_kg', 'altura_cm', 'pecho_cm', 'cintura_cm', 'cadera_cm', 'brazo_cm', 'muslo_cm'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const idCliente = searchParams.get('id_cliente');

  const resultado = await listarPaginado(Evaluacion, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    where: idCliente ? { id_cliente: idCliente } : {},
    order: [['fecha', 'DESC']],
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
  const { id_cliente, enfoque, dias_disponibles, minutos_por_sesion, restricciones, observaciones } = body;

  if (!id_cliente) {
    return NextResponse.json({ error: 'El cliente es obligatorio' }, { status: 400 });
  }

  const medidas = {};
  for (const campo of MEDIDAS) {
    if (body[campo] !== undefined && body[campo] !== null && body[campo] !== '') {
      medidas[campo] = body[campo];
    }
  }
  if (Object.keys(medidas).length === 0) {
    return NextResponse.json({ error: 'Debes registrar al menos una medida' }, { status: 400 });
  }

  if (enfoque && !ENFOQUES.includes(enfoque)) {
    return NextResponse.json({ error: 'Enfoque inválido' }, { status: 400 });
  }
  if (dias_disponibles !== undefined && dias_disponibles !== null && (dias_disponibles < 1 || dias_disponibles > 7)) {
    return NextResponse.json({ error: 'Los días disponibles deben estar entre 1 y 7' }, { status: 400 });
  }
  if (
    minutos_por_sesion !== undefined &&
    minutos_por_sesion !== null &&
    (minutos_por_sesion < 15 || minutos_por_sesion > 240)
  ) {
    return NextResponse.json({ error: 'Los minutos por sesión deben estar entre 15 y 240' }, { status: 400 });
  }

  try {
    const evaluacion = await Evaluacion.create({
      id_cliente,
      id_entrenador: payload.id_personal,
      ...medidas,
      enfoque: enfoque || null,
      dias_disponibles: dias_disponibles || null,
      minutos_por_sesion: minutos_por_sesion || null,
      restricciones: restricciones || null,
      observaciones: observaciones || null,
    });
    return NextResponse.json(evaluacion, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo registrar la evaluación');
  }
}
