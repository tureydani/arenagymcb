import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Meta, Cliente, Personal } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal, exigirRol } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

const TIPOS_MEDIDA = ['PESO', 'CINTURA', 'CADERA', 'PECHO', 'BRAZO', 'MUSLO'];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const idCliente = searchParams.get('id_cliente');
  const estado = searchParams.get('estado');

  const resultado = await listarPaginado(Meta, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    where: {
      ...(idCliente && { id_cliente: idCliente }),
      ...(estado && { estado }),
    },
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
  const { id_cliente, tipo_medida, valor_inicial, valor_objetivo, fecha_objetivo } = body;

  if (!id_cliente || !tipo_medida || valor_inicial === undefined || valor_objetivo === undefined) {
    return NextResponse.json({ error: 'Cliente, tipo de medida, valor inicial y valor objetivo son obligatorios' }, { status: 400 });
  }
  if (!TIPOS_MEDIDA.includes(tipo_medida)) {
    return NextResponse.json({ error: 'Tipo de medida inválido' }, { status: 400 });
  }
  if (Number(valor_inicial) <= 0 || Number(valor_objetivo) <= 0) {
    return NextResponse.json({ error: 'Los valores deben ser mayores a 0' }, { status: 400 });
  }
  if (Number(valor_inicial) === Number(valor_objetivo)) {
    return NextResponse.json({ error: 'El valor objetivo debe ser distinto al valor inicial' }, { status: 400 });
  }

  try {
    const meta = await Meta.create({
      id_cliente,
      id_entrenador: payload.id_personal,
      tipo_medida,
      valor_inicial,
      valor_objetivo,
      valor_actual: valor_inicial,
      fecha_objetivo: fecha_objetivo || null,
      estado: 'ACTIVA',
    });
    return NextResponse.json(meta, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'El cliente ya tiene una meta activa para esa medida');
  }
}
