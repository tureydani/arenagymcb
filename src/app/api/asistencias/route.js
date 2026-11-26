import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Asistencia, Cliente, RegistroMembresia, Membresia, VMembresiasVigentes } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  const resultado = await listarPaginado(Asistencia, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    order: [['fecha_hora', 'DESC']],
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
                { telefono: { [Op.iLike]: `%${q}%` } },
              ],
            }
          : undefined,
      },
      {
        model: RegistroMembresia,
        as: 'registro',
        attributes: ['id_registro'],
        include: [{ model: Membresia, as: 'membresia', attributes: ['nombre'] }],
      },
    ],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { id_cliente, metodo } = body;

  if (!id_cliente || !['QR', 'MANUAL'].includes(metodo)) {
    return NextResponse.json({ error: 'El cliente y el método (QR o MANUAL) son obligatorios' }, { status: 400 });
  }

  const vigente = await VMembresiasVigentes.findOne({ where: { id_cliente } });
  if (!vigente) {
    return NextResponse.json({ error: 'El cliente no tiene una membresía vigente' }, { status: 409 });
  }
  if (vigente.limite_asistencias && vigente.asistencias_usadas >= vigente.limite_asistencias) {
    return NextResponse.json({ error: 'El cliente ya alcanzó el límite de asistencias de su plan' }, { status: 409 });
  }

  try {
    const asistencia = await Asistencia.create({
      id_cliente,
      id_registro: vigente.id_registro,
      metodo,
      id_personal: payload.id_personal,
      anulado: false,
    });
    return NextResponse.json(asistencia, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'El cliente ya tiene una asistencia registrada hoy');
  }
}
