// Mismos valores que el dominio `d_canal_cobro` de arena_gym_schema.sql.
// Un solo lugar para esta lista: la usan los endpoints (validación) y las
// pantallas de pagos/ventas (select), igual que `categoriasCaja.js`.
export const CANALES_COBRO = ['EFECTIVO', 'QR', 'TRANSFERENCIA', 'TARJETA'];
