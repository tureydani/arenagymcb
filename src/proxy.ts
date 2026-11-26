import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';

const RUTAS_PUBLICAS = ['/api', '/api/health', '/api/personal/login'];

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return withCors(new NextResponse(null, { status: 204 }));
  }

  const { pathname } = request.nextUrl;

  if (RUTAS_PUBLICAS.includes(pathname)) {
    return withCors(NextResponse.next());
  }

  const payload = await verificarAuthPersonal(request);
  if (!payload) {
    return withCors(NextResponse.json({ error: 'No autorizado' }, { status: 401 }));
  }

  return withCors(NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
