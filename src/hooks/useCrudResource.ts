'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';

const LIMITE_POR_PAGINA = 20;

/**
 * Maneja listado paginado+buscable, crear, actualizar y una acción de
 * "cierre" (anular o desactivar, según el recurso) contra /api/<endpoint>.
 * Cada vista solo pasa el endpoint y consume { filas, total, ...acciones }.
 */
export function useCrudResource<T>(endpoint: string) {
  const [filas, setFilas] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await api.get(`/${endpoint}`, {
        params: { page, limit: LIMITE_POR_PAGINA, q: q || undefined },
      });
      setFilas(data.data);
      setTotal(data.total);
    } finally {
      setCargando(false);
    }
  }, [endpoint, page, q]);

  useEffect(() => {
    // Carga de datos desde la API: el setState real ocurre después del
    // await, en una respuesta asíncrona, no de forma síncrona en el efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recargar();
  }, [recargar]);

  function buscar(nuevoQ: string) {
    setQ(nuevoQ);
    setPage(1);
  }

  // El payload de creación no siempre tiene la misma forma que la fila de
  // listado (p.ej. registro-membresias lista desde una vista pero crea
  // contra la tabla base), así que se tipa aparte en vez de Partial<T>.
  async function crear(payload: Record<string, unknown>) {
    await api.post(`/${endpoint}`, payload);
    await recargar();
  }

  async function actualizar(id: number | string, payload: Partial<T>) {
    await api.patch(`/${endpoint}/${id}`, payload);
    await recargar();
  }

  async function cerrar(id: number | string, payload?: Record<string, unknown>) {
    await api.patch(`/${endpoint}/${id}/anular`, payload);
    await recargar();
  }

  return {
    filas,
    total,
    page,
    limit: LIMITE_POR_PAGINA,
    q,
    cargando,
    setPage,
    buscar,
    crear,
    actualizar,
    cerrar,
    recargar,
  };
}
