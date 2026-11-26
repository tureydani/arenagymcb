// Mismos valores que el dominio `d_categoria` de arena_gym_schema.sql.
// Un solo lugar para esta lista: la usan el endpoint (validación) y la
// pantalla de caja (select), para no mantener dos copias que se desincronicen
// si el dominio cambia en el SQL.
export const CATEGORIAS_CAJA = [
  'SUELDOS', 'ALQUILER', 'AGUA', 'ENERGIA', 'INTERNET', 'MANTENIMIENTO',
  'LIMPIEZA', 'OFICINA', 'EQUIPAMIENTO', 'PUBLICIDAD', 'EVENTOS',
  'IMPUESTOS', 'OTROS_EGRESOS', 'OTROS_INGRESOS', 'RETIRO_EFECTIVO',
];
