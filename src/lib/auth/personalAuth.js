import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

// jose (no jsonwebtoken) porque este módulo lo usa middleware.ts, que corre
// en el Edge Runtime (sin las APIs de Node que jsonwebtoken necesita).
const secret = () => new TextEncoder().encode(process.env.PERSONAL_JWT_SECRET);

export async function firmarTokenPersonal(personal) {
  return new SignJWT({
    id_personal: personal.id_personal,
    usuario: personal.usuario,
    nombre: personal.nombre,
    apellido: personal.apellido,
    roles: personal.roles,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
}

export async function verificarAuthPersonal(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Guardia de rol para usar en cada endpoint que lo necesite:
 *   const prohibido = exigirRol(payload, ['ADMIN']);
 *   if (prohibido) return prohibido;
 * `payload` es el que devuelve verificarAuthPersonal (incluye `roles`).
 * Devuelve null si el rol está permitido, o una respuesta 403 si no.
 */
export function exigirRol(payload, rolesPermitidos) {
  const roles = payload?.roles || [];
  const autorizado = rolesPermitidos.some((rol) => roles.includes(rol));
  if (autorizado) return null;
  return NextResponse.json(
    { error: 'No tiene permiso para realizar esta acción' },
    { status: 403 }
  );
}
