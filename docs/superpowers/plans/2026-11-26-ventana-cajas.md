# Ventana de Cajas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Caja screen (jornadas-caja + movimientos-caja) so a closed shift can be delivered three ways — in-app panel, PDF, CSV — plus a filterable history of closed shifts, a unified movements timeline (pagos + ventas + movimientos_caja), and automated tests for acceptance criteria 1–6.

**Architecture:** Extend `/api/jornadas-caja` and `/api/movimientos-caja` (no new `/api/caja/*` namespace). Two new pure-logic modules (`lib/db/resumenJornada.js`, `lib/db/movimientosUnificados.js`) compute the unified timeline and the "as of close" summary via raw SQL (`sequelize.query`), reused by the JSON, PDF, and CSV routes so all three never disagree. Frontend splits the single page into a tab shell (Caja actual / Historial) with a shared `PanelCierre` component.

**Tech Stack:** Next.js Route Handlers, Sequelize/Postgres (raw SQL for the unions), pdfkit, hand-rolled CSV, vitest (route handlers tested directly, no server needed).

**Spec:** `docs/superpowers/specs/2026-11-26-ventana-cajas-design.md`

## Global Constraints

- Do not modify `arena_gym_schema.sql` or its triggers.
- Nothing is ever deleted; corrections go through the existing `anular` pattern (motivo required, ADMIN-only, audited by the DB trigger).
- No `/api/caja/*` namespace — extend `/api/jornadas-caja` and `/api/movimientos-caja`.
- No headless browser for PDF — use `pdfkit`.
- CSV: UTF-8 with BOM, `;` separator, decimals with `.`, quotes escaping `"` and newlines.
- Every jornadas-caja/movimientos-caja endpoint except `anular` requires `exigirRol(payload, ['ADMIN', 'RECEPCION'])`; `anular` stays ADMIN-only.
- Money in Bs with 2 decimals; dates/times in America/La_Paz (already handled by `hoy_bolivia()` / `timestamptz` — do not re-derive timezone logic in JS beyond formatting).
- A CLOSED jornada's panel/PDF/CSV always show the saved `efectivo_esperado`/`efectivo_contado`/`diferencia` from `jornadas_caja`, never a live recompute from `v_jornada_resumen`.
- Tests run against whatever DB `.env.test.local` (if present) or `.env.local` points to; every test cleans up what it creates via the app's own endpoints (abrir→cerrar, anular), never raw SQL deletes, and never touches pre-existing rows.
- Only new dependency installs: `pdfkit` (+ `@types/pdfkit`), `vitest`. No dotenv — use Node's built-in `process.loadEnvFile`.

## Reglas de negocio no negociables (verificar siempre, no solo contra este plan)

Cada tarea de este plan existe para construir algo nuevo; estas reglas son
lo que ya es verdad en el sistema y ningún cambio puede romper, aunque
ninguna tarea individual las mencione en sus pasos:

1. Solo puede haber una jornada abierta a la vez (`uq_jornada_abierta`,
   ya en la DB — este plan no la reimplementa, pero ningún endpoint nuevo
   debe poder crear una segunda).
2. El arqueo se guarda **aunque no cuadre** — cerrar con diferencia ≠ 0
   nunca es un error, nunca se rechaza.
3. No se borra nada, nunca. Toda corrección es una anulación: motivo
   obligatorio, **solo ADMIN**, queda en `auditoria` por el trigger de la
   DB.
4. `arena_gym_schema.sql` y sus triggers no se tocan — si algún paso de
   una tarea pareciera necesitarlo, es que el paso está mal planteado, no
   que el esquema deba cambiar.

**Cada revisor de `subagent-driven-development` verifica el código de la
tarea contra esta lista completa, no solo contra los pasos/tests de la
tarea que le toca revisar.** Si en algún momento el código que una tarea
pide escribir, o una decisión ya tomada en este documento, chocara con
una de estas cuatro reglas, el revisor se detiene ahí mismo y pregunta —
no decide por su cuenta ni documenta el choque como una nota al pasar.

## Review Focus

- A jornada with **zero movements** closes fine (saldo_inicial = esperado, no division-by-zero or null-arithmetic in the resumen/PDF/CSV).
- `desde`/`hasta` filters on `GET /api/jornadas-caja` with an invalid or reversed range (desde > hasta) return an empty, non-erroring result, not a 500.
- The unified movimientos list for a jornada with **no pagos/ventas, only movimientos_caja** (or vice versa) still unions correctly — an empty branch of the `UNION ALL` must not break the query.
- Two rows (any origin) sharing the exact same `fecha_hora` paginate deterministically across repeated requests (the `(origen, id)` tie-break actually gets applied, not silently dropped by `sequelize.query` binding).
- `reporte.pdf`/`reporte.csv` for a jornada that doesn't exist, or belongs to no one, return 404 — not a thrown exception that becomes a raw 500 with a stack trace.

---

## Task 1: Test harness and PDF dependency setup

**Files:**
- Modify: `package.json` (add `pdfkit`, `@types/pdfkit`, `vitest`; add `"test": "vitest run"` script)
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/helpers/auth.ts`
- Create: `tests/helpers/jornada.ts`
- Test: `tests/helpers/auth.test.ts`

**Interfaces:**
- Produces: `tokenPara(roles: string[], idPersonal?: number): Promise<string>` in `tests/helpers/auth.ts` — mints a JWT via the real `firmarTokenPersonal` from `src/lib/auth/personalAuth.js`, no DB write.
- Produces: `exigirSinJornadaAbierta(token: string): Promise<void>` and `abrirJornadaDePrueba(token: string, saldoInicial: number): Promise<{ id_jornada: number }>` in `tests/helpers/jornada.ts` — call the real route handlers (imported directly, not over HTTP); later tasks' tests import these.

- [ ] **Step 1: Install dependencies**

Run: `npm install pdfkit && npm install -D @types/pdfkit vitest`

- [ ] **Step 2: Add the `test` script to `package.json`**

`"test": "vitest run"` alongside the existing scripts.

- [ ] **Step 3: Write `vitest.config.ts`**

Node environment (no jsdom needed — these are route-handler/unit tests, not component tests). Alias `@` to `./src` (mirrors `tsconfig.json`'s `paths`). `setupFiles: ['./tests/setup.ts']`. Run `test.fileParallelism: false` and `test.pool: 'forks'` with `singleFork: true` — the "only one open jornada" DB constraint makes concurrent test files unsafe.

- [ ] **Step 4: Write `tests/setup.ts`**

Loads env before any test file's imports resolve: if `.env.test.local` exists use it, else `.env.local`, via Node's built-in `process.loadEnvFile(path)` (no `dotenv` dependency). Throw a clear error at setup time if neither file exists, so a missing env fails fast instead of connecting to nothing.

- [ ] **Step 5: Write `tests/helpers/auth.ts`**

```ts
import { firmarTokenPersonal } from '@/lib/auth/personalAuth';

export async function tokenPara(roles: string[], idPersonal = 1): Promise<string> {
  return firmarTokenPersonal({
    id_personal: idPersonal,
    usuario: `test-${roles.join('-')}`,
    nombre: 'Test',
    apellido: 'Suite',
    roles,
  });
}
```

Note in a comment: `id_personal` must reference a real row (FK constraints on `id_personal_apertura`, etc.) — callers pass a real id from the seeded `personal` table (see Task 11 for how tests obtain one).

- [ ] **Step 6: Write `tests/helpers/jornada.ts`**

`exigirSinJornadaAbierta(token)`: calls the `abierta` route handler directly; if it returns a jornada (non-null), **throws** a clear error ("Hay una jornada abierta en esta base de datos — cerrala manualmente desde el panel antes de correr las pruebas") instead of closing it itself. The suite must never close or alter a jornada it didn't open — a jornada already open when the suite starts could be a real shift (even one left open from manual testing in this same session), and "los tests... no tocan datos existentes" rules out guessing it's safe to touch. `abrirJornadaDePrueba(token, saldoInicial)`: calls `exigirSinJornadaAbierta` first (so it fails the same loud way instead of silently stacking a jornada attempt on top of an existing one), then the `POST /api/jornadas-caja` handler, and returns the created jornada.

- [ ] **Step 7: Write the failing test `tests/helpers/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { tokenPara } from './auth';
import { verificarAuthPersonal } from '@/lib/auth/personalAuth';

describe('tokenPara', () => {
  it('produces a token verificarAuthPersonal accepts with the given roles', async () => {
    const token = await tokenPara(['ADMIN'], 7);
    const req = new Request('http://x', { headers: { authorization: `Bearer ${token}` } });
    const payload = await verificarAuthPersonal(req);
    expect(payload?.roles).toEqual(['ADMIN']);
    expect(payload?.id_personal).toBe(7);
  });
});
```

- [ ] **Step 8: Run it**

Run: `npm test -- tests/helpers/auth.test.ts`
Expected: PASS (this step only proves the harness itself works — env loads, `@` alias resolves, `personalAuth` signs/verifies).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/
git commit -m "test: add vitest harness and auth/jornada test helpers"
```

---

## Task 2: Role guard retrofit on existing endpoints

**Files:**
- Modify: `src/app/api/jornadas-caja/route.js` (**GET and POST** — GET is the historial list; it gets its role guard here, before Task 7 adds filters to it, so there is no window where a new behavior ships on an unguarded endpoint)
- Modify: `src/app/api/jornadas-caja/abierta/route.js` (GET — currently has no auth call at all)
- Modify: `src/app/api/jornadas-caja/[id]/cerrar/route.js` (PATCH)
- Modify: `src/app/api/movimientos-caja/route.js` (GET, POST)
- Test: `tests/roles.test.ts`

**Interfaces:**
- Consumes: `tokenPara`, `exigirSinJornadaAbierta`, `abrirJornadaDePrueba` from Task 1.
- Produces: nothing new — this task only adds `exigirRol(payload, ['ADMIN', 'RECEPCION'])` right after each endpoint's existing `verificarAuthPersonal` call (adding the call itself where missing, matching the pattern already used in `src/app/api/registro-membresias/[id]/anular/route.js`).

- [ ] **Step 1: Write the failing test `tests/roles.test.ts`**

For each of the 4 files' exported handlers, call it with an `ENTRENADOR` token and assert `403`; call it with a `RECEPCION` token and assert success (`200`/`201`, cleaning up what it creates via the Task 1 helpers). Also assert: a request with **no** `Authorization` header gets `401` (this is `proxy.ts`'s global guard, not `exigirRol` — included here so the "Cliente" side of criterion 6 is covered, since there is no client login in this codebase to mint a wrong-role token from).

```ts
it('blocks ENTRENADOR from abrir jornada', async () => {
  const token = await tokenPara(['ENTRENADOR']);
  const res = await POST(new Request('http://x/api/jornadas-caja', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ saldo_inicial_efectivo: 0 }),
  }));
  expect(res.status).toBe(403);
});
```

Repeat the shape for `jornadas-caja` **GET** (historial list, not just the POST shown above), `abierta` (GET), `cerrar` (PATCH, against a jornada opened with the RECEPCION helper), and `movimientos-caja` GET/POST — six handlers total, not four.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/roles.test.ts`
Expected: FAIL (current endpoints return 200/201/204 for ENTRENADOR, not 403).

- [ ] **Step 3: Add the role guard to the four files (six handlers — `jornadas-caja/route.js` has both GET and POST)**

In each, right after the existing `const payload = await verificarAuthPersonal(request);` (add that line to `abierta/route.js`, which currently has none), insert:

```js
const prohibido = exigirRol(payload, ['ADMIN', 'RECEPCION']);
if (prohibido) return prohibido;
```

Import `exigirRol` alongside the existing `verificarAuthPersonal` import in each file.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/roles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jornadas-caja src/app/api/movimientos-caja tests/roles.test.ts
git commit -m "fix: require ADMIN or RECEPCION role on all jornadas-caja/movimientos-caja endpoints"
```

---

## Task 3: CSV helper

**Files:**
- Create: `src/lib/csv.js`
- Test: `tests/csv.test.ts`

**Interfaces:**
- Produces: `construirCsv(filas: (string | number | null)[][], encabezados: string[]): string` — pure function, no DB. Returns the full file content: BOM (`﻿`), header row, data rows, `;`-separated, `\r\n` line endings, fields containing `;`, `"`, or a newline wrapped in `"..."` with internal `"` doubled, `null`/`undefined` rendered as `''`.

- [ ] **Step 1: Write the failing test `tests/csv.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { construirCsv } from '@/lib/csv';

describe('construirCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    expect(construirCsv([['a']], ['col']).charCodeAt(0)).toBe(0xFEFF);
  });
  it('separates fields with ; and rows with CRLF', () => {
    const csv = construirCsv([['1', '2']], ['a', 'b']);
    expect(csv).toContain('a;b\r\n1;2');
  });
  it('escapes a field containing a semicolon, a quote, and a newline', () => {
    const csv = construirCsv([['Motivo: "urgente"; revisar\nmañana']], ['obs']);
    expect(csv).toContain('"Motivo: ""urgente""; revisar\nmañana"');
  });
  it('renders null/undefined as an empty field', () => {
    expect(construirCsv([[null, undefined]], ['a', 'b'])).toContain('a;b\r\n;');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/csv.test.ts`
Expected: FAIL with "construirCsv is not a function" / module not found.

- [ ] **Step 3: Implement `construirCsv` in `src/lib/csv.js`**

Escape rule: a field needs quoting if it contains `;`, `"`, `\n`, or `\r`; quoting doubles any `"` inside. Join headers and each row's fields with `;`, join rows with `\r\n`, prefix the whole string with `﻿`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/csv.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.js tests/csv.test.ts
git commit -m "feat: add construirCsv helper for ; -separated, BOM-prefixed CSV"
```

---

## Task 4: Resumen helper (ABIERTA live / CERRADA frozen + anulaciones posteriores)

**Files:**
- Create: `src/lib/db/resumenJornada.js`
- Test: `tests/resumenJornada.test.ts`

**Interfaces:**
- Consumes: `JornadaCaja`, `VJornadaResumen` models from `@/lib/db/models`; `sequelize` default export from `@/lib/db/sequelize`.
- Produces:
  ```ts
  type ResumenJornada = {
    id_jornada: number; estado: 'ABIERTA' | 'CERRADA';
    saldo_inicial_efectivo: string; ingresos_efectivo: string; ingresos_qr: string;
    ingresos_transferencia: string; ingresos_tarjeta: string; otros_ingresos_efectivo: string;
    egresos_efectivo: string; efectivo_esperado: string; efectivo_contado: string | null;
    diferencia: string | null;
    anulaciones_posteriores: { cantidad: number; monto: string; detalle: AnulacionPosterior[] } | null;
  }
  type AnulacionPosterior = { origen: 'PAGO'|'VENTA'|'MOVIMIENTO'; id: number; motivo: string; anulado_por: string; anulado_at: string; monto: string };
  ```
  `obtenerResumenJornada(idJornada: number): Promise<ResumenJornada | null>` (null = jornada doesn't exist; caller 404s). Later tasks (5, 8, 9, 10) import this and nothing else from this file.

- [ ] **Step 1: Write the failing test `tests/resumenJornada.test.ts`**

Case A (ABIERTA): open a jornada via the Task 1 helper with `saldo_inicial_efectivo: 100`, register one `INGRESO` movimiento of `50` via the real `movimientos-caja` POST handler, call `obtenerResumenJornada`, and assert its `ingresos_efectivo`/`efectivo_esperado`/`otros_ingresos_efectivo` match a direct `VJornadaResumen.findByPk(id)` read for the same fields (criterion 4's "ABIERTA compares against `v_jornada_resumen`", proven at the unit level here). Close the jornada in a `finally`.

Case B (CERRADA + anulación posterior): open a jornada, register one movimiento of `30`, close it (`efectivo_contado` = esperado, so `diferencia` is `0`), then **after closing**, anular that movimiento with a motivo via the real anular handler. Call `obtenerResumenJornada` again: assert `efectivo_esperado`/`efectivo_contado`/`diferencia` are **unchanged** from what `cerrar` returned (frozen, not recomputed down by the anulación), and `anulaciones_posteriores` reports `{ cantidad: 1, monto: '30.00' }` with one `detalle` entry whose `origen` is `'MOVIMIENTO'`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/resumenJornada.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `obtenerResumenJornada` in `src/lib/db/resumenJornada.js`**

ABIERTA path: `JornadaCaja.findByPk`, then `VJornadaResumen.findByPk` for the breakdown (as `jornadas-caja/abierta/route.js` already does), `anulaciones_posteriores: null`.

CERRADA path: take `efectivo_esperado`/`efectivo_contado`/`diferencia`/`saldo_inicial_efectivo` straight from the `JornadaCaja` row (never recomputed). Recompute the **channel breakdown** with a raw query mirroring `v_jornada_resumen`'s CTEs but replacing `WHERE NOT anulado` with `WHERE (NOT anulado OR anulado_at > :fechaCierre)` on `pagos`, `ventas`, and `movimientos_caja` — this is what makes the breakdown reconcile with the frozen total (a row anulled *after* close was still counted *at* close time; a row anulled *before* close never was). Then a second raw query for `anulaciones_posteriores`:

```sql
SELECT 'PAGO' AS origen, id_pago AS id, motivo_anulacion, anulado_at, monto,
       p2.nombre || ' ' || p2.apellido AS anulado_por
  FROM pagos p JOIN personal p2 ON p2.id_personal = p.anulado_por
 WHERE p.id_jornada = :id AND p.anulado AND p.anulado_at > :fechaCierre
UNION ALL
SELECT 'VENTA', id_venta, motivo_anulacion, anulado_at, total, p2.nombre || ' ' || p2.apellido
  FROM ventas v JOIN personal p2 ON p2.id_personal = v.anulado_por
 WHERE v.id_jornada = :id AND v.anulado AND v.anulado_at > :fechaCierre
UNION ALL
SELECT 'MOVIMIENTO', id_movimiento, motivo_anulacion, anulado_at, monto, p2.nombre || ' ' || p2.apellido
  FROM movimientos_caja m JOIN personal p2 ON p2.id_personal = m.anulado_por
 WHERE m.id_jornada = :id AND m.anulado AND m.anulado_at > :fechaCierre
ORDER BY anulado_at
```

`cantidad`/`monto` are the row count and `SUM(monto)` of that same result; `null` when `fecha_cierre` is null (shouldn't happen for CERRADA, but guard it) or the query returns zero rows → report `{ cantidad: 0, monto: '0.00', detalle: [] }`, not `null`, so callers don't need an extra null-check when the jornada is CERRADA.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/resumenJornada.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/resumenJornada.js tests/resumenJornada.test.ts
git commit -m "feat: add obtenerResumenJornada (live for ABIERTA, frozen+anulaciones for CERRADA)"
```

---

## Task 5: `GET /api/jornadas-caja/[id]/resumen`

**Files:**
- Create: `src/app/api/jornadas-caja/[id]/resumen/route.js`
- Test: `tests/jornadas-caja.resumen.test.ts`

**Interfaces:**
- Consumes: `obtenerResumenJornada` (Task 4), `verificarAuthPersonal`/`exigirRol`.
- Produces: `GET` handler returning the `ResumenJornada` JSON, `404` if the jornada doesn't exist, `403` without ADMIN/RECEPCION.

- [ ] **Step 1: Write the failing test**

Open a jornada, call the route for its id with a RECEPCION token → `200` with `estado: 'ABIERTA'`. Call it for a made-up id (`999999`) → `404`. Call it with an ENTRENADOR token → `403`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/jornadas-caja.resumen.test.ts`
Expected: FAIL (route doesn't exist).

- [ ] **Step 3: Implement the route**

```js
export async function GET(request, { params }) {
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['ADMIN', 'RECEPCION']);
  if (prohibido) return prohibido;
  const { id } = await params;
  const resumen = await obtenerResumenJornada(Number(id));
  if (!resumen) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(resumen);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/jornadas-caja.resumen.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jornadas-caja/\[id\]/resumen tests/jornadas-caja.resumen.test.ts
git commit -m "feat: add GET /api/jornadas-caja/[id]/resumen"
```

---

## Task 6: Unified movimientos (pagos + ventas + movimientos_caja)

**Files:**
- Create: `src/lib/db/movimientosUnificados.js`
- Create: `src/app/api/jornadas-caja/[id]/movimientos/route.js`
- Test: `tests/movimientosUnificados.test.ts`

**Interfaces:**
- Produces: `listarMovimientosUnificados(idJornada: number, { page, limit, tipo, canal }): Promise<{ data: FilaMovimiento[], total: number, page: number, limit: number }>` in `movimientosUnificados.js`.
  ```ts
  type FilaMovimiento = {
    id: number; origen: 'MOVIMIENTO' | 'PAGO' | 'VENTA'; tipo: 'INGRESO' | 'EGRESO';
    categoria: string; concepto: string; canal_cobro: string | null; monto: string;
    fecha_hora: string; responsable: string; anulable: boolean;
  }
  ```
  `GET /api/jornadas-caja/[id]/movimientos` route wraps it with the role guard and query-param parsing (`page`, `limit`, `tipo`, `canal` — validate `tipo`/`canal` against the known enums, `400` on an invalid value rather than silently ignoring it).

- [ ] **Step 1: Write the failing test**

Open a jornada, register one `movimientos-caja` INGRESO of `20` and one EGRESO of `5` via the real handlers (no pagos/ventas test data needed — that's covered by the `UNION ALL` not breaking with empty branches, which Review Focus calls out; add a dedicated case with zero pagos/ventas rows to pin that). Call `listarMovimientosUnificados`: assert `total === 2`, both rows have `origen: 'MOVIMIENTO'`, `anulable: true`. Filter by `tipo: 'EGRESO'` → `total === 1`. Anular one, call again → `total === 1` (the anulled row is excluded). Close the jornada in a `finally`.

Pagination tie-break case (Review Focus): register three movimientos with the **same** `fecha_hora` (pass `fecha_hora` explicitly in the test's direct model inserts via the same `MovimientoCaja` model the route uses, bypassing the API's `default: now()` so all three share one timestamp exactly). Call `listarMovimientosUnificados` with `limit: 2` twice in a row (two separate calls, `page: 1` both times) and assert both calls return the exact same two ids in the exact same order — this proves the `(origen, id)` tie-break is actually applied in the `ORDER BY`, not silently dropped.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/movimientosUnificados.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `listarMovimientosUnificados`**

Build the `UNION ALL` (one branch per table, each selecting the same column list and a literal `origen`/`categoria` — `'MEMBRESIAS'` for pagos, `'VENTA_PRODUCTOS'` for ventas, the row's own `categoria` cast to text for movimientos_caja), filtered by `id_jornada` inside each branch (so Postgres can use the existing `ix_pagos_jornada`/`ix_ventas_jornada`/`ix_movcaja_jornada` indexes before the union), joined to `personal` for `responsable`, `WHERE NOT anulado` applied per-branch, optional `tipo`/`canal` filters applied in the outer query, `ORDER BY fecha_hora DESC, origen, id DESC`, `LIMIT :limit OFFSET :offset`. Run a second query with the same `WHERE`/`UNION` but `SELECT count(*)` for `total` (two round-trips is simpler and fast enough here than window functions over a 3-way union). Use `sequelize.query` with named bind parameters (`replacements`), never string-interpolated SQL.

- [ ] **Step 4: Implement the route**

Parses `page`/`limit`/`tipo`/`canal` from `searchParams`; `400` if `tipo` isn't `INGRESO`/`EGRESO` or `canal` isn't in `CANALES_COBRO` (reuse `@/lib/canalesCobro`) when provided.

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- tests/movimientosUnificados.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/movimientosUnificados.js src/app/api/jornadas-caja/\[id\]/movimientos tests/movimientosUnificados.test.ts
git commit -m "feat: unify pagos+ventas+movimientos_caja into one paginated timeline per jornada"
```

---

## Task 7: Historial filters on `GET /api/jornadas-caja`

**Files:**
- Modify: `src/app/api/jornadas-caja/route.js` (GET only — POST already touched in Task 2)
- Test: `tests/jornadas-caja.historial.test.ts`

**Interfaces:**
- Produces: `GET /api/jornadas-caja` now accepts `desde`, `hasta` (both `YYYY-MM-DD`, filtering `fecha_apertura`), `responsable` (`id_personal_apertura`), `estado`; each row in `data` gains `diferencia_cero: boolean | null` (`null` while `estado === 'ABIERTA'`).

- [ ] **Step 1: Write the failing test**

Open+close two jornadas with known `id_personal_apertura` (from the test token) and different `efectivo_contado` (one matching esperado exactly, one off by `10`). Call the route with `estado=CERRADA` → both appear, with `diferencia_cero: true` and `false` respectively. Call with `responsable=<otro id>` → neither appears. Call with `desde`/`hasta` bracketing today → both appear; with a range entirely in the past → empty `data`, `200` (not `500`) per Review Focus.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/jornadas-caja.historial.test.ts`
Expected: FAIL (filters ignored, no `diferencia_cero` field).

- [ ] **Step 3: Implement the filters**

Build `where` for `listarPaginado`'s `where` option: `estado` direct match; `id_personal_apertura` from `responsable`; `fecha_apertura` with `Op.gte`/`Op.lte` from `desde`/`hasta` (parse as dates; an invalid/reversed range simply yields no matches via the normal `Op.gte`/`Op.lte` comparison, no special-casing needed). After `listarPaginado` returns, map each row to add `diferencia_cero: row.estado === 'CERRADA' ? Number(row.diferencia) === 0 : null`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/jornadas-caja.historial.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jornadas-caja/route.js tests/jornadas-caja.historial.test.ts
git commit -m "feat: add historial filters (desde, hasta, responsable, estado) and diferencia_cero indicator"
```

---

## Task 8: PDF report

**Files:**
- Create: `src/lib/pdf/reporteCaja.js`
- Create: `src/app/api/jornadas-caja/[id]/reporte.pdf/route.js`
- Test: `tests/reporteCaja.pdf.test.ts`

**Interfaces:**
- Consumes: `obtenerResumenJornada` (Task 4), `listarMovimientosUnificados` (Task 6, called with a large `limit` to fetch the full list — a report has no pagination), `JornadaCaja`/`Personal` models.
- Produces: `generarReportePdfJornada({ jornada, resumen, movimientos, exportadoPor }): Promise<Buffer>` in `reporteCaja.js`. The route resolves all of this data, 404s if the jornada doesn't exist, and returns `new NextResponse(buffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="jornada-<id>.pdf"' } })`.

- [ ] **Step 1: Write the failing test**

Open+register one movimiento+close a jornada; build the same `{ jornada, resumen, movimientos, exportadoPor }` shape by hand from the real data; call `generarReportePdfJornada` and assert: the returned value is a `Buffer`, its first bytes are the PDF magic number (`%PDF`), and its length is `> 0`. (A byte-level content assertion is not meaningful for a PDF; this proves the generator runs end-to-end without throwing and produces a real PDF stream — visual/print correctness is verified manually per the design doc.)

404 case (Review Focus): call the **route** handler (not the generator) for a made-up jornada id → `404`, not a thrown exception / raw 500.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/reporteCaja.pdf.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `generarReportePdfJornada`**

A4 portrait `PDFDocument({ size: 'A4', margins: { ... } })`. Collect into a `Buffer` via `doc.on('data', chunks.push)` / `doc.on('end', resolve)`, then write and call `doc.end()`:
1. Header: "Arena Gym — Cierre de caja", fecha, `Jornada #<id>`.
2. Datos: responsable (apertura/cierre), horas, estado.
3. Resumen: saldo inicial, ingresos por canal, egresos, esperado, contado, **diferencia resaltada** (bold + red ink when `≠ 0`, matching the panel's ámbar/rojo rule). If `resumen.anulaciones_posteriores.cantidad > 0`, a note line: `"N anulación(es) posteriores al cierre, por Bs X"`.
4. Detalle de movimientos table (hora, tipo, concepto, canal, monto), excluding anulados (already true — `movimientos` only contains non-anulled rows per Task 6). Track `doc.y` before each row; if the next row would cross the bottom margin, call `doc.addPage()` and redraw the table header — this is the manual page-break control the design doc chose `pdfkit` for.
5. If `resumen.anulaciones_posteriores.detalle.length > 0`, a separate "Anulaciones posteriores al cierre" section listing each: motivo, quién anuló, cuándo, monto.
6. Footer on every page: generation timestamp, `exportadoPor` (name), page number (`doc.page.number` via pdfkit's `pageAdded`/`bufferPages` with a final pass, or a running counter kept by the code since page breaks are manual here), and two signature lines ("Recepción" / "Administración") on the **last** page only.

- [ ] **Step 4: Implement the route**

Role guard; `obtenerResumenJornada` for 404 + resumen; `listarMovimientosUnificados(id, { limit: 10000 })` for the full list; `JornadaCaja.findByPk` (already fetched by step 3's dependents, reuse) for apertura/cierre/responsable names (join `Personal` for `id_personal_apertura`/`id_personal_cierre`); `payload.nombre + ' ' + payload.apellido` as `exportadoPor`.

- [ ] **Step 5: Run it to verify it passes**

Run: `npm test -- tests/reporteCaja.pdf.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdf src/app/api/jornadas-caja/\[id\]/reporte.pdf tests/reporteCaja.pdf.test.ts
git commit -m "feat: generate the cierre de caja PDF report with pdfkit"
```

---

## Task 9: Single-jornada CSV report

**Files:**
- Create: `src/app/api/jornadas-caja/[id]/reporte.csv/route.js`
- Test: `tests/jornadas-caja.reporte-csv.test.ts`

**Interfaces:**
- Consumes: `obtenerResumenJornada`, `listarMovimientosUnificados`, `construirCsv` (Task 3).
- Produces: `GET` route returning `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="jornada-<id>.csv"`.

- [ ] **Step 1: Write the failing test**

Open+register a movimiento+close a jornada; call the route; assert: status `200`, body starts with the BOM, header row is exactly `jornada;fecha;hora;tipo;concepto;canal;categoria;monto_bs;responsable;anulado`, one data row per movimiento (the registered one — values match what was sent), and the tail contains summary rows for `saldo_inicial`, each ingreso channel total, `egresos`, `efectivo_esperado`, `efectivo_contado`, `diferencia` using the exact values from `obtenerResumenJornada` for that jornada (criterion 4: this CSV's numbers equal the resumen's).

404 case (Review Focus): call the route for a made-up jornada id → `404`, not a thrown exception / raw 500.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/jornadas-caja.reporte-csv.test.ts`
Expected: FAIL (route doesn't exist).

- [ ] **Step 3: Implement the route**

Reuse the same data-gathering as Task 8's route (resumen + full movimientos list). Rows: one per movimiento, mapping `FilaMovimiento` fields to the column order above (`anulado` column is always `'NO'` since the list already excludes anulados — include the literal column anyway, per the spec's column list, so the file shape stays stable if a future change surfaces anulled rows). Append the summary rows after a blank separator row. `construirCsv(filas, encabezados)` builds the body.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/jornadas-caja.reporte-csv.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jornadas-caja/\[id\]/reporte.csv tests/jornadas-caja.reporte-csv.test.ts
git commit -m "feat: add GET /api/jornadas-caja/[id]/reporte.csv"
```

---

## Task 10: Historial export CSV

**Files:**
- Create: `src/app/api/jornadas-caja/export.csv/route.js`
- Test: `tests/jornadas-caja.export-csv.test.ts`

**Interfaces:**
- Produces: `GET /api/jornadas-caja/export.csv` — same filter params as Task 7's historial GET (`desde`, `hasta`, `responsable`, `estado`), one row per jornada (not per movimiento): `id_jornada;fecha_apertura;fecha_cierre;responsable_apertura;responsable_cierre;estado;saldo_inicial;efectivo_esperado;efectivo_contado;diferencia;diferencia_cero`.

- [ ] **Step 1: Write the failing test**

Open+close one jornada with a known responsable; call the route with `estado=CERRADA` → the CSV contains exactly one data row for that jornada with the right values; call it with `responsable=<otro id>` → the row is absent.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/jornadas-caja.export-csv.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

Reuse the exact same `where`-building logic from Task 7 (extract it to a small shared function `construirFiltrosHistorial(searchParams)` in `jornadas-caja/route.js` and import it here, rather than duplicating the filter parsing) against `JornadaCaja` with `Personal` includes for apertura/cierre names, no pagination (historial export is meant to be the whole filtered set — note in a comment that this is a deliberate scope limit if row counts ever get large enough to matter, not a TODO to silently fix). Map rows through `construirCsv`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- tests/jornadas-caja.export-csv.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/jornadas-caja/export.csv src/app/api/jornadas-caja/route.js tests/jornadas-caja.export-csv.test.ts
git commit -m "feat: add GET /api/jornadas-caja/export.csv for filtered historial export"
```

---

## Task 11: Acceptance criteria 1–6 end-to-end suite

**Files:**
- Create: `tests/criterios-aceptacion.test.ts`

**Interfaces:**
- Consumes: every route handler touched in Tasks 2, 5, 6, 7, and the existing `abrir`/`cerrar`/`abierta`/`movimientos-caja`/`anular` handlers, plus all Task 1 helpers. No new production code — this task is pure verification that the six criteria hold through the real HTTP-shaped handler calls, end to end, not just per-module.
- Before the first test, a `beforeAll` queries `Personal` for one real `ADMIN` row and one real `RECEPCION` row (by role, `activo: true`) via the model directly, and fails the whole suite with a clear message ("run `node --env-file=.env.local scripts/seed.mjs` first") if either is missing — this is what Task 1's note about needing seeded `personal` rows means in practice.

- [ ] **Step 1: Write the six tests**

1. **Segunda jornada abierta → error claro.** Open a jornada (ADMIN), try to open a second → `409` with a non-empty `error` string.
2. **Movimiento sin jornada abierta → error claro.** `exigirSinJornadaAbierta` first (this test needs the precondition to genuinely hold, not be forced — if it throws because a real jornada is open, the test fails with that setup message rather than touching it), then `POST /api/movimientos-caja` → `409` with a message mentioning "jornada".
3. **Cierre con diferencia ≠ 0 se guarda igual.** Open with `saldo_inicial_efectivo: 100`, close with `efectivo_contado: 150` (no movimientos) → `200`, response `diferencia: '50.00'` (not rejected); then `GET .../resumen` confirms the same frozen values persist.
4. **Totales coinciden (panel vs PDF vs CSV vs vista).** For an ABIERTA jornada: compare `obtenerResumenJornada`'s fields against a direct `VJornadaResumen.findByPk` read (already proven in Task 4 — here assert the **route** `GET resumen` returns the same numbers as the direct helper call, closing the gap between unit and HTTP). For a CERRADA jornada with a post-close anulación: assert `GET resumen`, the CSV route's summary rows, and the PDF generator's input (`resumen` passed into `generarReportePdfJornada`) all derive from the exact same `obtenerResumenJornada` call — parse the CSV summary rows back into numbers and `expect` them `toEqual` the resumen JSON's.
5. **Anular sin motivo falla; con motivo, queda anulado y sale de los totales.** Register a movimiento, call anular with `{}` → `400`; call with `{ motivo: 'prueba' }` → `200`, `anulado: true`; `GET .../movimientos` for that jornada no longer lists it.
6. **Roles.** RECEPCION token on the `anular` endpoint → `403`. ENTRENADOR token on `abierta`, `POST jornadas-caja`, `GET resumen`, `GET movimientos` → `403` each (already individually covered in Task 2/5/6 — this test calls all four in one place as the literal "en todos los endpoints" the criterion names, so there's one test whose name matches the criterion). No-token request → `401` (the "Cliente" case — see Task 2's note on why this is 401, not 403).

- [ ] **Step 2: Run it to verify it fails if any route/behavior is wrong**

Run: `npm test -- tests/criterios-aceptacion.test.ts`
Expected: FAIL only if a prior task's implementation has a real defect (all underlying endpoints already exist by this point — this step is the integration check, not new-code TDD).

- [ ] **Step 3: Fix any failure found, re-run until green**

If a test fails, the bug is in a prior task's file, not this one — fix it there, note the fix in this task's commit body.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests across Tasks 1–11 PASS.

- [ ] **Step 5: Analytical check of criterion 9 (~1000 jornadas/movimientos in <2s) — no seeding, confirmed in writing**

Not a vitest test (approved scope keeps automation to criteria 1–6). Read `listarMovimientosUnificados` (Task 6) and the historial `GET` (Task 7) and confirm in this task's commit body, as a short checklist: (a) the unified-movimientos query filters by `id_jornada` *inside* each `UNION ALL` branch, so Postgres can use `ix_pagos_jornada`/`ix_ventas_jornada`/`ix_movcaja_jornada` before the union, not after; (b) both list endpoints apply `LIMIT`/`OFFSET` in SQL (via `listarPaginado` or the raw query's own `LIMIT`), never fetch-then-slice in JS; (c) neither endpoint loads all rows into memory to sort or filter — `ORDER BY`/`WHERE` are in the SQL, not `Array.prototype.sort`/`.filter` on the result. If any of the three doesn't hold, that's a real defect to fix here, not a note to pass along.

- [ ] **Step 6: Commit**

```bash
git add tests/criterios-aceptacion.test.ts
git commit -m "test: add end-to-end suite for acceptance criteria 1-6"
```

---

## Task 12: Frontend — tab shell, Caja actual, role-aware nav

**Files:**
- Modify: `src/app/dashboard/jornadas-caja/page.tsx` (becomes the tab shell)
- Create: `src/app/dashboard/jornadas-caja/CajaActual.tsx`
- Modify: `src/app/dashboard/DashboardShell.tsx` (hide "Caja" link for ENTRENADOR)

**Interfaces:**
- Consumes: `GET .../movimientos` (Task 6) for the table instead of `GET /api/movimientos-caja`; `GET .../resumen` (Task 5) instead of the inline resumen already embedded in `GET .../abierta`'s response (keep using `abierta` to detect whether a jornada is open at all — it's cheaper than calling `resumen` speculatively — but once a jornada id is known, `CajaActual` fetches its own live resumen via the new endpoint so the same component later reused for Historial's `PanelCierre`, built in Task 13, behaves identically for ABIERTA jornadas too).
- Produces: `CajaActual` exported as the default export of its file, taking no props (reads `sessionStorage`'s `personal` the same way `DashboardShell` already does, to decide whether to show the ADMIN-only anular buttons — mirrors the existing unenforced-by-UI pattern noted in `ESTRUCTURA.md`, now actually applied here).

- [ ] **Step 1: Extract the current page into `CajaActual.tsx`**

Move the existing body of `jornadas-caja/page.tsx` (jornada state, abrir/cerrar modals, `Tarjeta` cards) into `CajaActual.tsx` unchanged in spirit, with two behavior changes:
- The movements table fetches `/jornadas-caja/${jornada.id_jornada}/movimientos` (paginated, with `tipo`/`canal` `<select>` filters added above the table, same `SearchBar`-row layout convention as other pages) instead of `/movimientos-caja`.
- The row-level "Anular" action reads the row's `origen` field and calls `PATCH /api/pagos/${id}/anular`, `/api/ventas/${id}/anular`, or `/api/movimientos-caja/${id}/anular` accordingly (a small `rutaAnular(origen: string, id: number): string` helper in the same file) — only rendered when `personal.roles.includes('ADMIN')`.
- The cierre modal (`modalCerrar`) gains a live diferencia readout: as the user types `efectivo_contado`, compute `Number(efectivo_contado) - Number(resumen.efectivo_esperado_calculado)` on every keystroke (controlled input, not `defaultValue`/`FormData`-only like the rest of the form) and show it in a line above the submit button — `var(--success)` text when it's exactly `0`, `var(--danger)` otherwise (two states, matching the design doc's "verde (0) y ámbar/rojo (≠0)" and the same colors `Historial`'s `diferencia_cero` badge uses — no extra threshold invented). This is the "calcula la diferencia en vivo" requirement from the original prompt, not yet built.
- Add "Descargar PDF" / "Descargar CSV" buttons, visible once a jornada exists regardless of estado (useful mid-shift too, not just after close), linking to `/api/jornadas-caja/${id}/reporte.pdf` / `.csv` (plain `<a href>` with the stored token appended the same way other download-style links in this codebase would need to carry auth — since these routes require a JWT header, not a query param, use a small `descargarArchivo(url, nombreArchivo)` helper that `fetch`es with the `Authorization` header from `api`'s interceptor pattern, reads the blob, and triggers a client-side download via an object URL).

- [ ] **Step 2: Rewrite `page.tsx` as the tab shell**

Two tabs ("Caja actual", "Historial") as plain buttons toggling local state (no router/query-param tabs needed — matches the simplicity of the rest of this dashboard); renders `<CajaActual />` or `<Historial />` (Task 13).

- [ ] **Step 3: Hide the "Caja" nav link for ENTRENADOR**

In `DashboardShell.tsx`'s `SECCIONES` rendering, filter out the `/dashboard/jornadas-caja` entry when `personal.roles` doesn't include `'ADMIN'` or `'RECEPCION'` — the first role-aware hiding in this codebase (ESTRUCTURA.md already flags this as not-yet-done); keep every other link exactly as-is.

- [ ] **Step 4: Manual verification (no automated frontend tests per the approved scope)**

Log in as `entrenador1` / `Test1234`: confirm "Caja" is absent from the sidebar and `GET /api/jornadas-caja/abierta` would 403 if hit directly (already covered by Task 2's tests). Log in as `recepcion1`: open a jornada, register a pago/venta from their respective screens, confirm both appear in the Caja actual table with the right `origen`-derived label, filter by `tipo`/`canal`, download PDF and CSV and open them.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/jornadas-caja src/app/dashboard/DashboardShell.tsx
git commit -m "feat: split Caja into tabs, unify pagos/ventas/movimientos in Caja actual, hide nav link from ENTRENADOR"
```

---

## Task 13: Frontend — Historial tab and shared PanelCierre

**Files:**
- Create: `src/app/dashboard/jornadas-caja/Historial.tsx`
- Create: `src/app/dashboard/jornadas-caja/PanelCierre.tsx`
- Modify: `src/app/dashboard/jornadas-caja/CajaActual.tsx` (show `PanelCierre` immediately after a successful cierre, before returning to the "no jornada abierta" state)

**Interfaces:**
- Consumes: `GET /api/jornadas-caja` with filters (Task 7), `GET .../resumen` (Task 5), `GET .../reporte.pdf`/`.csv` (Tasks 8–9), `GET .../export.csv` (Task 10).
- Produces: `PanelCierre({ idJornada }: { idJornada: number })` — fetches and renders the resumen (cards + the anulaciones-posteriores note when present) plus "Descargar PDF"/"Descargar CSV" buttons; used both by `Historial` (on row click, in a `Modal`) and by `CajaActual` (inline, right after closing).

- [ ] **Step 1: Write `PanelCierre.tsx`**

Same card layout as `CajaActual`'s existing `Tarjeta` grid (reuse that component — export it from `CajaActual.tsx` or hoist it to a small shared file if both need it; hoisting to `src/app/dashboard/jornadas-caja/Tarjeta.tsx` is the cleaner call since two files now use it). Diferencia card colored green when `0`, ámbar/rojo otherwise (reuse the color logic already in the design doc's approved rules). When `resumen.anulaciones_posteriores?.cantidad > 0`, an amber note block: `"N anulación(es) posteriores al cierre, por Bs X"`.

- [ ] **Step 2: Write `Historial.tsx`**

Filters row: `desde`/`hasta` date inputs, `responsable` `<select>` (fetch `/personal?limit=100`, same pattern as other pages' client/producto pickers), `estado` `<select>`. `DataTable` of jornadas with a `diferencia_cero` badge column (hidden/'—' for `ABIERTA` rows). Row click opens `PanelCierre` for that jornada in a `Modal`. "Exportar historial CSV" button hits `GET /api/jornadas-caja/export.csv` with the current filters, downloaded the same way as `CajaActual`'s PDF/CSV buttons (reuse the `descargarArchivo` helper — hoist it next to `Tarjeta` if both files need it).

- [ ] **Step 3: Wire `CajaActual`'s post-cierre view**

After a successful `cerrar` call, instead of immediately falling back to the "no jornada abierta" empty state, show `<PanelCierre idJornada={jornada.id_jornada} />` with a "Volver" button that then clears to the empty state — this is the "inmediatamente después del cierre" delivery the design doc calls for.

- [ ] **Step 4: Manual verification**

Close a jornada with a non-zero diferencia: confirm the post-cierre panel shows it in amber/red, the PDF downloads and opens with the same number bolded, the CSV's last rows match. From Historial, filter by date range and by responsable, open an old jornada's panel, confirm its numbers match what was true when it closed even after anulling something in it from a separate ADMIN session.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/jornadas-caja
git commit -m "feat: add Historial tab with filters, export, and shared PanelCierre"
```

---

## Task 14: Local run instructions, capture list, and SQL/implementation diff note

**Files:**
- Create: `docs/superpowers/specs/2026-11-26-ventana-cajas-handoff.md`

- [ ] **Step 1: Write the handoff doc**

Sections:
- **Levantar el proyecto en local**: `npm install`, `.env.local` contents required (already exists, just lists the vars it needs: `DB_*`, `PERSONAL_JWT_SECRET`), `node --env-file=.env.local scripts/seed.mjs` to get the `admin1`/`recepcion1`/`entrenador1` test accounts, `npm run dev`, log in at `http://localhost:3002`.
- **Correr las pruebas**: `npm test`; note that it writes to whichever DB `.env.local` (or `.env.test.local`) points at, and that it cleans up after itself but should never be pointed at a database with real gym data.
- **Pantallas a capturar** (for the thesis document): Caja actual with an open jornada and the unified movements table showing a pago, a venta, and a movimiento together; the "Registrar movimiento" modal; the cierre modal with a non-zero diferencia shown live in amber/red; the post-cierre `PanelCierre`; the Historial tab with filters applied; the downloaded PDF open in a reader; the downloaded CSV open in Excel/LibreOffice with the tildes intact and the summary rows at the bottom.
- **Diferencias entre el SQL y la implementación**: none expected to the schema/triggers themselves (not touched); note the two interpretive calls made where the SQL didn't fully specify UI/API behavior — the CERRADA-jornada "frozen totals + anulaciones posteriores" rule, and `categoria` for pagos/ventas in the unified timeline being a fixed label (`'MEMBRESIAS'`/`'VENTA_PRODUCTOS'`) rather than a real DB column, chosen to match `v_resultado_mensual`'s own categorization so the numbers and the existing reporting view stay in the same language.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-26-ventana-cajas-handoff.md
git commit -m "docs: add local run instructions, screenshot list, and SQL/implementation diff note"
```
