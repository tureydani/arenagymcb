import { NextResponse } from 'next/server';
import { Op } from 'sequelize';
import { Pago, RegistroMembresia, Cliente, Membresia, JornadaCaja } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';
import { CANALES_COBRO } from '@/lib/canalesCobro';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const idJornada = searchParams.get('id_jornada');

  const resultado = await listarPaginado(Pago, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    where: idJornada ? { id_jornada: idJornada } : {},
    order: [['fecha_pago', 'DESC']],
    include: [
      {
        model: RegistroMembresia,
        as: 'registro',
        attributes: ['id_registro', 'id_cliente', 'id_membresia'],
        required: !!q,
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
          { model: Membresia, as: 'membresia', attributes: ['nombre'] },
        ],
      },
    ],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { id_registro, monto, canal_cobro, observaciones } = body;

  if (!id_registro || monto === undefined || monto === null) {
    return NextResponse.json({ error: 'La inscripción y el monto son obligatorios' }, { status: 400 });
  }
  if (Number(monto) <= 0) {
    return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
  }
  if (!CANALES_COBRO.includes(canal_cobro)) {
    return NextResponse.json({ error: 'Canal de cobro inválido' }, { status: 400 });
  }

  const registro = await RegistroMembresia.findByPk(id_registro);
  if (!registro || registro.anulado) {
    return NextResponse.json({ error: 'La inscripción no existe o está anulada' }, { status: 404 });
  }

  const jornadaAbierta = await JornadaCaja.findOne({ where: { estado: 'ABIERTA' } });
  if (!jornadaAbierta) {
    return NextResponse.json({ error: 'No hay una jornada de caja abierta' }, { status: 409 });
  }

  try {
    const pago = await Pago.create({
      id_registro,
      id_jornada: jornadaAbierta.id_jornada,
      monto,
      canal_cobro,
      id_personal: payload.id_personal,
      observaciones: observaciones || null,
      anulado: false,
    });
    return NextResponse.json(pago, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo registrar el pago');
  }
}
