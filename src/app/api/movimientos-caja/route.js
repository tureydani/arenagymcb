import { NextResponse } from 'next/server';
import { JornadaCaja, MovimientoCaja } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';
import { CATEGORIAS_CAJA } from '@/lib/categoriasCaja';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const idJornada = searchParams.get('id_jornada');

  const resultado = await listarPaginado(MovimientoCaja, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    camposBusqueda: ['concepto'],
    q: searchParams.get('q'),
    where: idJornada ? { id_jornada: idJornada } : {},
    order: [['fecha_hora', 'DESC']],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { tipo, categoria, monto, concepto } = body;

  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido: debe ser INGRESO o EGRESO' }, { status: 400 });
  }
  if (!CATEGORIAS_CAJA.includes(categoria)) {
    return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
  }
  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
  }
  if (!concepto?.trim()) {
    return NextResponse.json({ error: 'El concepto es obligatorio' }, { status: 400 });
  }

  const jornadaAbierta = await JornadaCaja.findOne({ where: { estado: 'ABIERTA' } });
  if (!jornadaAbierta) {
    return NextResponse.json({ error: 'No hay una jornada de caja abierta' }, { status: 409 });
  }

  try {
    const movimiento = await MovimientoCaja.create({
      id_jornada: jornadaAbierta.id_jornada,
      tipo,
      categoria,
      monto,
      concepto,
      id_personal: payload.id_personal,
      anulado: false,
    });
    return NextResponse.json(movimiento, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'No se pudo registrar el movimiento');
  }
}
