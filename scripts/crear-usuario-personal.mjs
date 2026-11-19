// Crea (o actualiza) un usuario en la tabla `personal` con su password
// hasheado, para poder probar el login.
//
// Uso:
//   node --env-file=.env.local scripts/crear-usuario-personal.mjs \
//     <usuario> <password> <nombre> <apellido> <ROL1,ROL2>
//
// Ejemplo:
//   node --env-file=.env.local scripts/crear-usuario-personal.mjs \
//     admin Secreto123 Daniel Escobar ADMIN
//
// Roles válidos (según arena_gym_schema.sql): ADMIN, RECEPCION, ENTRENADOR.

import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const [usuario, password, nombre, apellido, rolesArg] = process.argv.slice(2);

if (!usuario || !password || !nombre || !apellido || !rolesArg) {
  console.error(
    'Uso: node --env-file=.env.local scripts/crear-usuario-personal.mjs <usuario> <password> <nombre> <apellido> <ROL1,ROL2>'
  );
  process.exit(1);
}

const roles = rolesArg.split(',').map((r) => r.trim().toUpperCase());
const rolesValidos = ['ADMIN', 'RECEPCION', 'ENTRENADOR'];
const rolInvalido = roles.find((r) => !rolesValidos.includes(r));
if (rolInvalido) {
  console.error(`Rol inválido: "${rolInvalido}". Válidos: ${rolesValidos.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  await client.connect();

  const passwordHash = await bcrypt.hash(password, 10);

  const { rows } = await client.query(
    `INSERT INTO personal (nombre, apellido, usuario, password_hash, roles, activo)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (usuario) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           nombre = EXCLUDED.nombre,
           apellido = EXCLUDED.apellido,
           roles = EXCLUDED.roles,
           activo = true
     RETURNING id_personal, nombre, apellido, usuario, roles`,
    [nombre, apellido, usuario, passwordHash, roles]
  );

  console.log('Usuario creado/actualizado:', rows[0]);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
