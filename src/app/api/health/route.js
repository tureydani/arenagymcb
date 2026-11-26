import { NextResponse } from 'next/server';

export async function GET() {
  const horaBolivia = new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
  return NextResponse.json({ status: 'ok', hora_bolivia: horaBolivia });
}
