'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/utils/api';

export default function LoginForm() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const { data } = await api.post('/personal/login', { usuario, password });
      sessionStorage.setItem('personalToken', data.token);
      sessionStorage.setItem('personal', JSON.stringify(data.personal));
      router.push('/dashboard');
    } catch {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <div className="mb-8 text-center">
        <Image
          src="/images/logo.png"
          alt="Arena Gym"
          width={80}
          height={80}
          className="mx-auto h-20 w-20 rounded-2xl object-cover shadow-sm"
        />
        <h2 className="font-display mt-4 text-3xl font-bold text-[var(--text-primary)]">ARENA GYM</h2>
        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Sistema de Administración</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="usuario" className="text-sm font-medium text-[var(--text-primary)]">
            Usuario
          </label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
            disabled={cargando}
            placeholder="Ingresa tu usuario"
            className="rounded-xl border border-[var(--surface-border)] p-3 text-base text-[var(--text-primary)] transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)] focus:outline-none disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-[var(--text-primary)]">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={cargando}
            placeholder="Ingresa tu contraseña"
            className="rounded-xl border border-[var(--surface-border)] p-3 text-base text-[var(--text-primary)] transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.15)] focus:outline-none disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="mt-2 rounded-xl bg-[var(--accent)] p-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cargando ? 'Ingresando...' : 'Ingresar al Sistema'}
        </button>
      </form>
    </div>
  );
}
