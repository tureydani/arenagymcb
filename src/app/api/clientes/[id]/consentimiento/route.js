import { NextResponse } from 'next/server';
import { Cliente } from '@/lib/db/models';

// Consentimiento informado (SF-17): lo exige un trigger de la DB para poder
// crear una evaluación o una propuesta de rutina con IA. `consentimiento_at`
// nunca se limpia al revocar (queda como historial de cuándo se otorgó);
// revocar solo marca `consentimiento_revocado_at`. Volver a otorgar limpia
// la revocación y renueva la fecha/versión (ver constraint
// chk_clientes_consent en arena_gym_schema.sql: at y version van juntos).
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { accion, version } = await request.json();

  const cliente = await Cliente.findByPk(id);
  if (!cliente) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  if (accion === 'OTORGAR') {
    if (!version?.trim()) {
      return NextResponse.json({ error: 'La versión del consentimiento es obligatoria' }, { status: 400 });
    }
    await cliente.update({
      consentimiento_at: new Date(),
      consentimiento_version: version,
      consentimiento_revocado_at: null,
    });
    return NextResponse.json(cliente);
  }

  if (accion === 'REVOCAR') {
    const vigente = cliente.consentimiento_at && !cliente.consentimiento_revocado_at;
    if (!vigente) {
      return NextResponse.json({ error: 'El cliente no tiene un consentimiento vigente para revocar' }, { status: 409 });
    }
    await cliente.update({ consentimiento_revocado_at: new Date() });
    return NextResponse.json(cliente);
  }

  return NextResponse.json({ error: 'Acción inválida: debe ser OTORGAR o REVOCAR' }, { status: 400 });
}
