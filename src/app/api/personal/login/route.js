import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Personal } from '@/lib/db/models';
import { firmarTokenPersonal } from '@/lib/auth/personalAuth';

export async function POST(request) {
  const { usuario, password } = await request.json();

  if (!usuario || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña son requeridos' }, { status: 400 });
  }

  const personal = await Personal.unscoped().findOne({
    where: { usuario, activo: true },
  });

  if (!personal || !(await bcrypt.compare(password, personal.password_hash))) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
  }

  const token = await firmarTokenPersonal(personal);
  await personal.update({ ultimo_acceso: new Date() });

  const personalJson = personal.toJSON();
  delete personalJson.password_hash;

  return NextResponse.json({ token, personal: personalJson });
}
