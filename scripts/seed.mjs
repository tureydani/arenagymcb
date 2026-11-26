// Carga datos de prueba para desarrollo/QA manual (no se corre en producción).
// Es idempotente: se puede correr varias veces sin duplicar filas.
// Usa SQL directo (no los modelos Sequelize) porque este script corre con
// Node puro, fuera del bundler de Next, que es el único que resuelve los
// imports sin extensión que usan los modelos.
//
// Uso:
//   node --env-file=.env.local scripts/seed.mjs

import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const PASSWORD_PRUEBA = 'Test1234';

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function seedPersonal() {
  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 10);
  const personal = [
    { usuario: 'admin1', nombre: 'Andrea', apellido: 'Soliz', roles: ['ADMIN'] },
    { usuario: 'recepcion1', nombre: 'Rocío', apellido: 'Pérez', roles: ['RECEPCION'] },
    { usuario: 'entrenador1', nombre: 'Erick', apellido: 'Flores', roles: ['ENTRENADOR'] },
  ];

  for (const p of personal) {
    const { rows } = await client.query(
      `INSERT INTO personal (nombre, apellido, usuario, password_hash, roles, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (usuario) DO NOTHING
       RETURNING usuario`,
      [p.nombre, p.apellido, p.usuario, passwordHash, p.roles]
    );
    console.log(rows[0] ? `+ personal creado: ${p.usuario}` : `= personal ya existía: ${p.usuario}`);
  }
}

async function seedMembresias() {
  const planes = [
    { nombre: 'Mensual', descripcion: 'Acceso 30 días', duracion_dias: 30, precio: 150, limite: null },
    { nombre: 'Trimestral', descripcion: 'Acceso 90 días', duracion_dias: 90, precio: 400, limite: null },
    { nombre: 'Pase 10 clases', descripcion: 'Válido 30 días, 10 ingresos', duracion_dias: 30, precio: 120, limite: 10 },
  ];

  for (const plan of planes) {
    const { rows } = await client.query(
      `INSERT INTO membresias (nombre, descripcion, duracion_dias, precio, limite_asistencias, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (nombre) DO NOTHING
       RETURNING nombre`,
      [plan.nombre, plan.descripcion, plan.duracion_dias, plan.precio, plan.limite]
    );
    console.log(rows[0] ? `+ plan creado: ${plan.nombre}` : `= plan ya existía: ${plan.nombre}`);
  }
}

async function seedClientes() {
  const { rows: admins } = await client.query('SELECT id_personal FROM personal ORDER BY id_personal LIMIT 1');
  const registradoPor = admins[0]?.id_personal;

  const clientes = [
    { nombre: 'Ana', apellido: 'Gutiérrez', telefono: '70011001', email: 'ana.gutierrez@example.com', nacimiento: '1995-04-12' },
    { nombre: 'Luis', apellido: 'Mamani', telefono: '70011002', email: 'luis.mamani@example.com', nacimiento: '1988-09-30' },
    { nombre: 'Carla', apellido: 'Vargas', telefono: '70011003', email: 'carla.vargas@example.com', nacimiento: '2001-01-20' },
  ];

  for (const c of clientes) {
    const { rows } = await client.query(
      `INSERT INTO clientes (nombre, apellido, telefono, email, fecha_nacimiento, activo, registrado_por)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (telefono) WHERE activo DO NOTHING
       RETURNING nombre`,
      [c.nombre, c.apellido, c.telefono, c.email, c.nacimiento, registradoPor]
    );
    console.log(rows[0] ? `+ cliente creado: ${c.nombre} ${c.apellido}` : `= cliente ya existía: ${c.nombre} ${c.apellido}`);
  }
}

async function main() {
  await client.connect();
  await seedPersonal();
  await seedMembresias();
  await seedClientes();
  console.log(`\nListo. Password de prueba para el personal nuevo: ${PASSWORD_PRUEBA}`);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
