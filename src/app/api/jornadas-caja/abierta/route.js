import { NextResponse } from 'next/server';
import { JornadaCaja, VJornadaResumen } from '@/lib/db/models';

// La pantalla de caja consulta esto al cargar para saber si hay una
// jornada abierta y, si la hay, su resumen (de la vista) sin tener que
// pedir una lista y filtrar en el cliente.
export async function GET() {
  const jornada = await JornadaCaja.findOne({ where: { estado: 'ABIERTA' } });
  if (!jornada) {
    return NextResponse.json(null);
  }

  const resumen = await VJornadaResumen.findByPk(jornada.id_jornada);
  return NextResponse.json({ ...jornada.toJSON(), resumen });
}
