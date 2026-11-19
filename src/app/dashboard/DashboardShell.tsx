'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ToastProvider } from '@/components/ui/Toast';

type Personal = {
  id_personal: number;
  nombre: string;
  apellido: string;
  usuario: string;
  roles: string[];
};

const SECCIONES = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/clientes', label: 'Clientes' },
  { href: '/dashboard/personal', label: 'Personal' },
  { href: '/dashboard/membresias', label: 'Membresías' },
  { href: '/dashboard/registro-membresias', label: 'Inscripciones' },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [personal, setPersonal] = useState<Personal | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = sessionStorage.getItem('personalToken');
    const guardado = sessionStorage.getItem('personal');

    if (!token || !guardado) {
      router.replace('/');
      return;
    }

    // sessionStorage no existe en SSR, así que leerlo y pasarlo a estado
    // solo puede pasar en un efecto, al montar en el cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonal(JSON.parse(guardado));
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem('personalToken');
    sessionStorage.removeItem('personal');
    router.push('/');
  }

  if (!personal) return null;

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <aside className="flex w-60 flex-col border-r border-[var(--surface-border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--surface-border)] px-5 py-5">
            <p className="font-display text-lg font-bold text-[var(--accent)]">Arena Gym</p>
          </div>

          <nav className="flex-1 px-3 py-4">
            {SECCIONES.map((s) => {
              const activo = pathname === s.href;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`mb-1 flex items-center border-l-2 px-3 py-2 text-sm ${
                    activo
                      ? 'border-[var(--accent)] bg-[var(--accent-bg)] font-medium text-[var(--accent)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--background)]'
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--surface-border)] px-5 py-4">
            <p className="text-sm font-medium">
              {personal.nombre} {personal.apellido}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{personal.roles.join(', ')}</p>
            <button
              onClick={handleLogout}
              className="mt-3 text-sm text-[var(--danger)] hover:underline"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-[var(--background)] p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
