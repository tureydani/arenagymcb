import { NextResponse } from 'next/server';

/**
 * Traduce un error de Sequelize/Postgres a una respuesta HTTP consistente.
 * Centraliza lo que antes se repetía (try/catch distinto) en cada POST/PATCH:
 * - violación de índice único -> 409
 * - error lanzado por un trigger (RAISE EXCEPTION en el SQL) -> 422, con el
 *   mensaje del trigger tal cual (ya viene en español y claro, RNF-07)
 * - cualquier otro error -> 500 genérico, sin exponer detalles internos
 */
export function respuestaErrorDb(err, mensajePorDefecto = 'No se pudo completar la operación') {
  if (err.name === 'SequelizeUniqueConstraintError') {
    return NextResponse.json({ error: mensajePorDefecto }, { status: 409 });
  }

  // Los triggers del esquema usan RAISE EXCEPTION; Sequelize los reporta como
  // SequelizeDatabaseError y el texto del RAISE queda en err.original.message.
  const mensajeTrigger = err.original?.message || err.parent?.message;
  if (err.name === 'SequelizeDatabaseError' && mensajeTrigger) {
    return NextResponse.json({ error: mensajeTrigger }, { status: 422 });
  }

  console.error(err);
  return NextResponse.json({ error: mensajePorDefecto }, { status: 500 });
}
