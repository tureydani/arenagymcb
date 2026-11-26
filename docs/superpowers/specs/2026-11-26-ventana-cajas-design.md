# Ventana de cajas (jornada, cierre, PDF y CSV) — diseño

## Intención y por qué

El panel de Arena Gym ya tiene una pantalla de Caja (abrir/cerrar jornada,
registrar ingresos/egresos). Para el proyecto de grado, el dueño necesita
que esa pantalla entregue la información del cierre de tres formas (panel
visual, PDF para imprimir/archivar, CSV para Excel) y un historial de
jornadas cerradas, porque hoy el cierre solo queda en la base de datos sin
una salida formal que el administrador pueda revisar o presentar.

## Goals

- Entregar el cierre de una jornada de tres formas: panel dentro del
  sistema, PDF, CSV.
- Historial de jornadas cerradas con filtros, exportable en CSV.
- La tabla de movimientos de la jornada actual debe mostrar pagos y ventas
  además de los movimientos de caja (hoy solo muestra `movimientos_caja`).
- Pruebas automatizadas (vitest) de los criterios de aceptación 1 a 6 del
  pedido original.

## Non-goals / anti-goals

- No se toca `arena_gym_schema.sql` ni los triggers.
- No se borra ningún registro; todo error se corrige con `anular`
  (motivo obligatorio, solo ADMIN, vía el patrón ya existente).
- No es contabilidad formal, ni maneja bancos ni fondos fuera de caja.
- No se crea el namespace `/api/caja/*` del prompt original: se extiende
  `/api/jornadas-caja` y `/api/movimientos-caja`, ya construidos y
  probados en esta misma sesión.
- No se usa un navegador headless para el PDF (complica Vercel).

## Constraints

- Next.js App Router, Route Handlers, Sequelize contra Supabase (pool
  chico, transaction pooler — ver `src/lib/db/sequelize.js`).
- Autenticación/roles ya resueltos por `verificarAuthPersonal` +
  `exigirRol` (`src/lib/auth/personalAuth.js`); no se reinventan.
- Errores de trigger/constraint ya se traducen con `respuestaErrorDb`
  (`src/lib/db/errores.js`); los endpoints nuevos lo reusan, no agregan
  su propio manejo de `SequelizeUniqueConstraintError`.
- Patrón de UI existente (`DataTable`, `Modal`, `ConfirmDialog`,
  `useCrudResource`, `Toast`) se reusa; no se reinventa un sistema de
  diseño nuevo para esta pantalla.
- Sin framework de pruebas instalado hoy; se agrega **vitest**, nada más
  (según indicaste).
- Sin librería de PDF/CSV instalada hoy.

## Approaches consideradas

**Namespace de endpoints** — ya decidido en la conversación: extender
`/api/jornadas-caja` y `/api/movimientos-caja` en vez de `/api/caja/*`.
No hay otra opción sobre la mesa aquí.

**Librería de PDF** — dos opciones viables en Vercel (ninguna necesita
Chromium/navegador headless):
1. **pdfkit**: API de bajo nivel (dibujás texto/líneas/tablas a mano,
   controlás el flujo de página línea por línea). Más código para la
   tabla de movimientos, pero control total y preciso de dónde corta la
   página — justo el requisito "no cortar tablas" es más fácil de
   garantizar así, porque uno mismo decide cuándo saltar de página.
2. **@react-pdf/renderer**: componentes tipo React (`<View>`, `<Text>`)
   con un motor de layout tipo Flexbox. Más cómodo para el diseño general,
   pero el salto de página automático de una tabla larga es menos
   predecible si una fila no "sabe" que no debe cortarse a la mitad, y
   requiere envolver la lógica de datos en JSX en el propio Route Handler.

   **Mi elección: pdfkit.** El reporte es una página A4 con una tabla de
   movimientos que no puede cortarse a la mitad — control manual de
   paginación es exactamente lo que pide ese criterio de aceptación.
   Stream nativo de Node (sin pasos de build adicionales), huella de
   dependencia más chica.

**Pruebas con base de datos** — no existe una segunda base de datos de
prueba hoy. Tres caminos:
1. Pedirte que crees un segundo proyecto Supabase y me pases sus
   credenciales en `.env.test.local`.
2. Correr contra la misma DB de `.env.local` (desarrollo), y que cada test
   limpie lo que crea usando los propios endpoints de la app (abrir →
   cerrar/anular), igual que hice a mano durante esta sesión.
3. Envolver cada test en una transacción de Sequelize con rollback
   automático — descartado: los Route Handlers abren sus propias
   transacciones (`sequelize.transaction()`), no hay transacciones
   anidadas vía `async_hooks` configuradas en este proyecto, así que un
   rollback del test no alcanzaría a las escrituras hechas por el propio
   endpoint bajo prueba.

   **Mi elección: la opción 2**, con `.env.test.local` opcional si más
   adelante querés separar — lo dejo preparado (`dotenv` carga
   `.env.test.local` si existe, si no cae a `.env.local`) pero no te pido
   nada nuevo ahora. Lo marco fuerte en el código y en el README de specs:
   estas pruebas escriben filas reales (que ellas mismas limpian) en la
   base que configures.

## Criterios de aceptación con prueba automatizada (vitest, del pedido original)

1. Abrir una segunda jornada con una ya abierta devuelve un error claro.
2. Registrar pago, venta o movimiento sin jornada abierta falla con
   mensaje claro.
3. Cerrar con diferencia ≠ 0 guarda el arqueo igualmente y se ve
   resaltado en panel, PDF y CSV.
4. Los totales del panel, el PDF y el CSV coinciden entre sí y con la
   vista de resumen de la base de datos.
5. Anular un movimiento sin motivo falla; con motivo, queda anulado,
   aparece en la auditoría y desaparece de los totales.
6. Un Recepcionista no puede anular; un Cliente o Entrenador recibe 403
   en todos los endpoints.

Los criterios 7-9 del pedido original (CSV abre bien en Excel/LibreOffice,
PDF se imprime en A4 sin cortar tablas, historial con ~1000 filas responde
en <2s) siguen siendo parte de "hecho" pero se verifican a mano (fuente
de datos real, apariencia visual, performance), no con vitest.

## Ajuste a lo existente que el criterio 6 obliga

Hoy **ningún** endpoint de `jornadas-caja` exige rol (ni abrir, ni listar,
ni cerrar) y `movimientos-caja` solo lo exige en `anular`. Eso viola la
regla original ("Recepcionista abre/cierra y registra movimientos;
Administrador además anula... El Entrenador y el Cliente no acceden") y
el criterio 6 tal cual. Agrego `exigirRol(payload, ['ADMIN','RECEPCION'])`
a **todos** los endpoints de `jornadas-caja` y `movimientos-caja`
(existentes y nuevos) que no sean `anular`, que sigue ADMIN-only.

## Lo que decidiste (va tal cual)

- Extender `/api/jornadas-caja` y `/api/movimientos-caja`; nada de
  `/api/caja/*`.
- `GET /api/jornadas-caja`: filtros `desde`, `hasta`, `responsable`,
  `estado`; indicador de diferencia ≠ 0 en cada fila.
- `GET /api/jornadas-caja/[id]/resumen`: panel de cierre desde
  `v_jornada_resumen`.
- `GET /api/jornadas-caja/[id]/movimientos`: une `movimientos_caja` +
  `pagos` + `ventas` (sin anulados), con un campo `origen`, filtros por
  `tipo` y `canal`.
- `GET /api/jornadas-caja/[id]/reporte.pdf` y `reporte.csv`: nuevas, misma
  auth/rol que el resto.
- `GET /api/jornadas-caja/export.csv`: historial completo con los
  filtros aplicados.
- Lo existente (`abierta`, abrir, cerrar, `movimientos-caja` anular) queda
  igual salvo que algo no cumpla los criterios 1-6.
- Frontend: una ventana "Caja" con pestañas **Caja actual** / **Historial**.
  "Caja actual" usa el endpoint unificado de movimientos (pagos + ventas +
  movimientos de caja).
- Dependencias: `pdfkit` (PDF), CSV a mano (sin librería), `vitest` como
  único framework de pruebas.
- Sin capturas de mi parte; al final dejo instrucciones para levantar el
  proyecto y la lista de pantallas a capturar.

## Decisiones finales (aprobadas)

- **Forma del endpoint unificado de movimientos**: cada fila trae
  `{ id, origen: 'MOVIMIENTO'|'PAGO'|'VENTA', tipo: 'INGRESO'|'EGRESO',
  categoria, concepto, canal_cobro, monto, fecha_hora, responsable,
  anulable }`. `categoria` es la de `movimientos_caja` cuando aplica, o
  `'MEMBRESIAS'`/`'VENTA_PRODUCTOS'` para pagos/ventas (mismo criterio que
  `v_resultado_mensual`). `UNION ALL` en SQL crudo (`sequelize.query`), no
  3 `findAll` + merge en JS. Paginación `{ data, total, page, limit }`
  (mismo shape que `listarPaginado`). Orden `fecha_hora DESC`, desempate
  `(origen, id)`.
- **Anular desde la tabla unificada**: el frontend despacha según
  `origen` a `/api/pagos/:id/anular`, `/api/ventas/:id/anular` o
  `/api/movimientos-caja/:id/anular` — no se crea un cuarto endpoint.
- **Roles**: `exigirRol(['ADMIN','RECEPCION'])` en todos los endpoints de
  `jornadas-caja` y `movimientos-caja` salvo `anular` (solo ADMIN).
  Corrige también lo existente (hoy ninguno lo exigía salvo `anular`).
  Verificado: el único consumidor de estos endpoints es la propia pantalla
  de Caja (`dashboard/jornadas-caja/page.tsx`) y el link del sidebar — no
  hay otro módulo que los llame con otro rol, así que no se rompe nada.
- **Historial y exportación**: Recepción y Admin pueden verlos y
  exportarlos (no exclusivo de Admin). Recepción ve **todas** las
  jornadas, sin filtro implícito por responsable — `responsable` sigue
  disponible como filtro manual para cualquiera de los dos roles.
- **Indicador de diferencia ≠ 0**: solo el badge booleano por fila
  (`diferencia_cero: boolean`), sin filtro dedicado.
- **CSV**: `;` como separador, BOM UTF-8, comillas dobles escapando `"` y
  saltos de línea; función compartida `construirCsv(filas, columnas)` en
  `lib/csv.js`, reusada entre `reporte.csv` y `export.csv`. Filas de
  resumen al final, con el arqueo guardado (ver punto siguiente).
- **Firmas en el PDF**: dos líneas con nombre impreso debajo ("Recepción"
  / "Administración"), sin firma digital ni imagen.

## Jornada cerrada + anulaciones posteriores (regla de negocio nueva)

El cierre guarda `efectivo_esperado`, `efectivo_contado` y `diferencia`
en `jornadas_caja` (ya pasa hoy). Para una jornada **CERRADA**, el panel,
el PDF y el CSV **siempre muestran esos valores guardados**, nunca un
recálculo en vivo desde `v_jornada_resumen` — porque `v_jornada_resumen`
excluye anulados y, si algo se anuló después del cierre (permitido, solo
ADMIN, como hoy), el recálculo en vivo ya no coincidiría con lo que se
cerró ese día.

Si hay anulaciones con `anulado_at > jornadas_caja.fecha_cierre` sobre
pagos/ventas/movimientos de esa jornada: se cuentan y suman (monto total),
y se muestran como una nota aparte —
*"N anulación(es) posteriores al cierre, por Bs X"* — tanto en el panel
como en el PDF (el PDF además las lista en su sección de anulaciones, con
motivo y quién anuló). La nota es informativa; **no ajusta** el
arqueo ya guardado.

Para una jornada **ABIERTA**, el resumen sigue siendo el cálculo en vivo
de `v_jornada_resumen` (como ya funciona hoy en `/jornadas-caja/abierta`).

### Criterio 4 (coherencia de totales) con esta regla

- Jornada **ABIERTA**: panel, PDF (si se pidiera) y CSV deben coincidir
  entre sí **y** con `v_jornada_resumen`.
- Jornada **CERRADA** con anulaciones posteriores: panel, PDF y CSV deben
  coincidir entre sí, y ambos contra los **valores guardados** en
  `jornadas_caja` (no contra `v_jornada_resumen`, que ya no representa lo
  que se cerró).

## Lo que queda a cargo del que implemente

- Texto exacto y estilos Tailwind de las pestañas/tarjetas (sigue la
  paleta ya definida en `globals.css`).
- Nombres de archivo de los nuevos componentes de UI (p. ej. si el
  historial va en un componente separado dentro de la misma página o en
  un archivo propio).
- Redacción exacta de los mensajes de error/éxito (sigue el tono ya usado
  en el resto del panel: corto, en español, sin tecnicismos).
