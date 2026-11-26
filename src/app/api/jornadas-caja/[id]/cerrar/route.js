import { NextResponse } from 'next/server';
import { JornadaCaja, VJornadaResumen } from '@/lib/db/models';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';

export async function PATCH(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const { id } = await params;
  const { efectivo_contado, observaciones } = await request.json();

  if (efectivo_contado === undefined || Number(efectivo_contado) < 0) {
    return NextResponse.json({ error: 'El efectivo contado es obligatorio y no puede ser negativo' }, { status: 400 });
  }

  const jornada = await JornadaCaja.findByPk(id);
  if (!jornada) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  if (jornada.estado !== 'ABIERTA') {
    return NextResponse.json({ error: 'Esta jornada ya está cerrada' }, { status: 409 });
  }

  // El esperado se calcula en la vista (suma pagos+ventas+movimientos ya
  // filtrando anulados); el arqueo se guarda aunque no cuadre con lo contado.
  const resumen = await VJornadaResumen.findByPk(id);
  const efectivoEsperado = resumen.efectivo_esperado_calculado;
  const diferencia = Number(efectivo_contado) - Number(efectivoEsperado);

  await jornada.update({
    estado: 'CERRADA',
    fecha_cierre: new Date(),
    id_personal_cierre: payload.id_personal,
    efectivo_esperado: efectivoEsperado,
    efectivo_contado,
    diferencia,
    ...(observaciones !== undefined && { observaciones }),
  });

  return NextResponse.json(jornada);
}
