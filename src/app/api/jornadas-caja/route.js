import { NextResponse } from 'next/server';
import { JornadaCaja } from '@/lib/db/models';
import { listarPaginado } from '@/lib/db/listarPaginado';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';
import { respuestaErrorDb } from '@/lib/db/errores';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resultado = await listarPaginado(JornadaCaja, {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    order: [['fecha_apertura', 'DESC']],
  });
  return NextResponse.json(resultado);
}

export async function POST(request) {
  const payload = await verificarAuthPersonal(request);
  const body = await request.json();
  const { saldo_inicial_efectivo, observaciones } = body;

  if (saldo_inicial_efectivo === undefined || Number(saldo_inicial_efectivo) < 0) {
    return NextResponse.json({ error: 'El saldo inicial es obligatorio y no puede ser negativo' }, { status: 400 });
  }

  try {
    const jornada = await JornadaCaja.create({
      estado: 'ABIERTA',
      id_personal_apertura: payload.id_personal,
      saldo_inicial_efectivo,
      observaciones: observaciones || null,
    });
    return NextResponse.json(jornada, { status: 201 });
  } catch (err) {
    return respuestaErrorDb(err, 'Ya hay una jornada abierta: debe cerrarse antes de abrir otra');
  }
}
