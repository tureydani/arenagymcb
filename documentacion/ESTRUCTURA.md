# Estructura del proyecto

Scaffold de Next.js (App Router, TypeScript, Tailwind v4) que se conecta a la base
de datos Arena Gym (`arena_gym_schema.sql`). Referencia para saber dónde va cada
cosa a medida que se agregan vistas.

## `src/app/`
Rutas de la aplicación (App Router). Cada carpeta = una ruta.
- `page.tsx` — login (pantalla inicial `/`).
- `dashboard/layout.tsx` — sidebar fijo + verificación de sesión; envuelve
  todas las secciones del panel. Cada sección es una subruta propia
  (`dashboard/clientes`, `dashboard/membresias`, etc.), no un switch de tabs.
- `dashboard/page.tsx` — pantalla de inicio del panel (placeholder simple).
- `dashboard/<recurso>/page.tsx` — una página por recurso de negocio: lista
  (`DataTable` + `SearchBar` + `Pagination`) y su modal de alta/edición.
- `api/<recurso>/route.js` (+ `[id]/route.js`, `[id]/anular/route.js`) — un
  endpoint REST por recurso. `GET` acepta `?page=&limit=&q=` y devuelve
  `{ data, total, page, limit }` (ver `lib/db/listarPaginado.js`).
- `api/health/route.js` — único endpoint público además del login; devuelve
  `{ status, hora_bolivia }` para verificar que el despliegue conecta a
  Supabase (está en `RUTAS_PUBLICAS` de `proxy.ts`).

## `src/proxy.ts`
Guardia de rutas (en Next 16 este es el reemplazo de `middleware.ts`):
intercepta todas las peticiones a `/api/*`, maneja CORS y exige un JWT válido
(vía `verificarAuthPersonal`) salvo en las rutas públicas (`/api`,
`/api/personal/login`). Corre en el Edge Runtime, por eso usa `jose` en vez
de `jsonwebtoken`.

## `src/lib/db/`
- `sequelize.js` — conexión a Postgres (Supabase, Transaction pooler). Cachea
  la instancia en `globalThis` para reusarla entre invocaciones serverless.
- `models/<tabla>.js` — un modelo Sequelize por tabla del esquema. Las vistas
  de solo lectura (`v_membresias_vigentes`, etc.) también tienen su propio
  modelo (`vMembresiasVigentes.js`) mapeado con `tableName` a la vista.
- `models/index.js` — registro central de modelos y sus relaciones
  (`belongsTo`/`hasMany`). Cada bloque de asociación va guardado detrás de
  un `if (!Modelo.associations.alias)`: con Turbopack este módulo se
  puede re-ejecutar en caliente sin que las clases de Sequelize se
  reinicien, y volver a llamar `belongsTo`/`hasMany` con el mismo alias
  lanza `SequelizeAssociationError` (rompe todas las rutas que importan
  modelos, no solo la que cambió).
- `listarPaginado.js` — helper compartido: pagina + busca por `ILIKE` sobre
  los campos que cada endpoint le indique. Todo endpoint de listado lo usa,
  en vez de reimplementar la paginación cada vez.
- `errores.js` — `respuestaErrorDb(err, mensajePorDefecto)`: traduce
  errores de Sequelize/Postgres a una respuesta HTTP consistente (único
  violado -> 409; error de trigger, `RAISE EXCEPTION` en el SQL -> 422 con
  el mensaje del trigger tal cual; cualquier otro -> 500 genérico, logueado
  en servidor). Todo `catch` de un `create`/`update` contra la DB lo usa en
  vez de repetir el `if (err.name === 'SequelizeUniqueConstraintError')`.

## `src/lib/auth/`
- `personalAuth.js` — firma (`firmarTokenPersonal`) y verifica
  (`verificarAuthPersonal`) el JWT del personal (staff: admin/recepción/
  entrenador), usando `jose` y el secreto `PERSONAL_JWT_SECRET`. También
  exporta `exigirRol(payload, rolesPermitidos)`: guardia de rol que cada
  endpoint llama donde la spec lo pida (p.ej. planes y personal son solo
  Administrador). `proxy.ts` ya garantiza que `payload` existe (401 si no);
  `exigirRol` solo decide si el rol alcanza (403 si no). Patrón:
  ```js
  const payload = await verificarAuthPersonal(request);
  const prohibido = exigirRol(payload, ['Administrador']);
  if (prohibido) return prohibido;
  ```
- Si más adelante se agrega login de clientes (app móvil), va en un archivo
  paralelo (`clienteAuth.js`) con su propio secreto.

## `src/lib/categoriasCaja.js`
`CATEGORIAS_CAJA`: valores del dominio `d_categoria` del esquema SQL, en un
solo lugar para que el endpoint (validación) y el `<select>` de la pantalla
de caja no mantengan dos copias de la misma lista.

## `src/utils/api.js`
Instancia de `axios` (`baseURL: '/api'`) que usan los componentes del
dashboard para llamar a la API. Agrega el token automáticamente desde
`sessionStorage` y redirige a `/` si el servidor responde 401.

## `src/hooks/useCrudResource.ts`
Hook genérico que encapsula el ciclo completo de una vista de listado:
fetch paginado/buscable, `crear`, `actualizar` y `cerrar` (anular/desactivar).
Cada página de recurso solo le pasa el nombre del endpoint — no hay que
reescribir fetch+estado en cada vista nueva.

## `src/components/ui/` — kit compartido (usarlo siempre, no reinventar por vista)
- `DataTable.tsx` — tabla genérica (columnas por props, estados de
  carga/vacío, columna de acciones).
- `RowActionButton.tsx` + `icons.tsx` — botón de acción de fila: siempre
  icono + tooltip, nunca texto, para que todas las tablas se vean igual.
- `Modal.tsx` — shell de modal reusado por todos los formularios de
  crear/editar.
- `ConfirmDialog.tsx` — confirmación genérica; con `pedirMotivo` se vuelve el
  diálogo de **anulación** (exige motivo, como pide la DB).
- `Toast.tsx` (+ `ToastProvider`, ya montado en `dashboard/layout.tsx`) —
  mensajes de éxito/error, nunca banners inline por componente.
- `SearchBar.tsx`, `Pagination.tsx` — pensados para server-side: la página
  les pasa `page`/`q` y el hook se encarga de pedirlo a la API.
- `Button.tsx`, `FormField.tsx` (+ `inputClass`) — primitivas de formulario.

## Patrón de borrado: anular vs. desactivar
- Tablas con `anulado/motivo_anulacion/anulado_por/anulado_at` (pagos,
  ventas, movimientos_caja, asistencias, **registro_membresias**): el botón
  de "eliminar" abre `ConfirmDialog` con `pedirMotivo` y llama a
  `PATCH /api/<recurso>/:id/anular`. Nunca se borra la fila.
- Catálogos simples con solo `activo` (personal, clientes, membresías,
  productos, máquinas): el botón activa/desactiva con
  `PATCH /api/<recurso>/:id { activo }`, confirmado con `ConfirmDialog` sin
  motivo.

## Convenciones
- **Sesión**: el token (`personalToken`) y los datos del usuario (`personal`)
  se guardan en `sessionStorage`, no en cookies — se pierden al cerrar la
  pestaña.
- **Nombres**: todo en español, siguiendo los nombres de tabla/columna del
  esquema SQL (`personal`, `usuario`, `roles`, etc.), para que el modelo
  Sequelize sea un mapeo directo sin traducciones.
- **Variables de entorno**: `.env.local` (ignorado por git) con `DB_*` para
  la conexión y `PERSONAL_JWT_SECRET` para firmar tokens.
- **Diseño**: paleta fija en `globals.css` (fondo/superficie/acento/
  éxito/peligro/advertencia); tipografía *Manrope* (marca/encabezados,
  clase `.font-display`) + *Inter* (cuerpo/tablas).

## Hecho hasta ahora
Login + Personal + Clientes + Membresías + Registro de membresías
(inscripciones, con `fecha_fin` calculada por trigger de la DB). `GET
/api/health` (hora de Bolivia) para verificar despliegue/conexión a Supabase.

Verificado manualmente de punta a punta (login de los 3 roles, guardas de
rol 403, inscripción con `fecha_fin`/precio copiados por el trigger,
anulación con motivo obligatorio y su fila en `auditoria`): ver
`scripts/seed.mjs`.

## `scripts/seed.mjs`
Carga datos de prueba idempotentes (se puede correr varias veces): 3
usuarios de personal, uno por rol (`admin1`/`recepcion1`/`entrenador1`,
password `Test1234`), 3 planes y 3 clientes. Usa SQL directo con `pg`, no
los modelos Sequelize, porque corre con Node puro fuera del bundler de
Next (que es el único que resuelve los imports sin extensión de
`lib/db/models`). Uso: `node --env-file=.env.local scripts/seed.mjs`.

Jornadas de caja + Movimientos de caja (abrir/cerrar jornada, registrar
ingreso/egreso, anular movimiento — solo una jornada ABIERTA a la vez,
garantizado por un índice único parcial en la DB; el cierre usa la vista
`v_jornada_resumen` para el efectivo esperado, no se recalcula en JS).

Productos + Máquinas (catálogos simples, patrón `activo` igual a
membresías; máquinas además tiene `operativa` para marcar falla temporal
sin desactivar el catálogo). Sin restricción de rol en creación/edición
(igual que clientes), porque la spec solo marca planes y personal como
exclusivos de Administrador.

Pagos (cobro contra una inscripción vigente, exige jornada abierta).
Ventas + Detalle de ventas (`sequelize.transaction()`: por cada ítem
bloquea el producto con `lock: t.LOCK.UPDATE`, decide precio normal/mayoreo
según `cantidad_mayoreo`, descuenta stock y crea el detalle; si algo falla
hace rollback completo — probado con stock insuficiente). Asistencias
(deriva `id_registro` de `v_membresias_vigentes`, no de un selector manual;
rechaza sin membresía vigente o si ya llegó al `limite_asistencias`; el
índice único parcial de la DB bloquea una segunda asistencia el mismo día).
Las tres con anulación ADMIN-only (`exigirRol`); anular una venta repone el
stock de cada línea (lo decide la API, no hay trigger para esto). Endpoint
extra de solo lectura `GET /api/ventas/[id]` para el detalle con líneas,
aparte del listado paginado (evita el join hasMany en la página con
límite/offset). `listarPaginado` ahora acepta `include` (Sequelize) para
estos joins; se usa con `distinct: true` cuando hay include.

Consentimiento informado del cliente: no es tabla propia, son columnas de
`clientes` (`consentimiento_at/version/revocado_at`). `PATCH
/api/clientes/[id]/consentimiento` con `{ accion: 'OTORGAR'|'REVOCAR',
version }`: otorgar nunca pisa `consentimiento_at` histórico al revocar
(solo marca `consentimiento_revocado_at`), y volver a otorgar limpia esa
revocación. Es prerrequisito real: el trigger `fn_exigir_consentimiento`
bloquea evaluaciones y propuestas de rutina sin esto. Acción en la ficha de
cliente (`dashboard/clientes`), no una pantalla aparte.

Evaluaciones (snapshot histórico sin anular/activo — solo create+listado;
valida "al menos una medida" y rangos de días/minutos en la API antes de
llegar al CHECK de la DB, para no mostrar el texto crudo del constraint).
Metas (una ACTIVA por cliente y tipo de medida, índice único parcial;
`PATCH` solo cambia `valor_actual`/`estado`, sin anular — "CANCELADA" es el
borrado lógico aquí). Rutinas + rutina_ejercicios (`sequelize.transaction()`
crea la rutina y sus ejercicios juntos; valida día/orden duplicado y rangos
de series/repeticiones/descanso antes del insert; solo una rutina ACTIVA
por cliente, igual que metas; `archivar` es el cierre de ciclo, no hay
anular; detalle vía `GET /api/rutinas/[id]` con ejercicios + máquina,
aparte del listado). Registros de cumplimiento (liga a
`id_rutina_ejercicio`, no a cliente directo — el join a cliente es de 3
niveles: cumplimiento → ejercicio → rutina → cliente; CRUD completo
create+update, sin camino de borrado en el esquema). Evaluaciones, metas y
rutinas restringidas a `ADMIN`/`ENTRENADOR` (`exigirRol`).

**Nota operativa de desarrollo**: agregar un modelo Sequelize *nuevo* (no
solo una asociación nueva sobre un modelo existente) a un servidor Next dev
que ya está corriendo puede dejar una clase de ese modelo sin las
asociaciones del `models/index.js` por una recarga en caliente a medias de
Turbopack (distinto del caso de alias duplicado que ya soluciona el guard
`if (!Modelo.associations.alias)`). Si un endpoint nuevo da
`SequelizeEagerLoadingError` pese a que el código de asociación es
correcto, reiniciar el servidor dev primero antes de seguir investigando.

## Pendiente (próximas iteraciones, mismo patrón que arriba)
Propuestas de rutina (IA/Gemini, no es CRUD plano); Notificaciones;
Conversaciones+Mensajes (Telegram); Auditoría (solo lectura); vistas
`v_jornada_resumen` y `v_resultado_mensual` (solo lectura). Para cada una: modelo en
`lib/db/models`, endpoint(s) en `app/api/<recurso>`, página en
`app/dashboard/<recurso>` con `DataTable`+`Modal`+`useCrudResource`, y
agregar la entrada correspondiente al array `SECCIONES` en
`dashboard/layout.tsx`. Usar siempre `exigirRol` en los endpoints que lo
requieran y `respuestaErrorDb` en los `catch` contra la DB (ver `lib/auth/`
y `lib/db/` arriba), para no reintroducir controles de rol o manejo de
errores ad hoc por recurso. Las operaciones que tocan varias tablas van en
`sequelize.transaction()` directamente (ver `api/ventas/route.js` y
`api/ventas/[id]/anular/route.js`: venta → stock, con `lock: t.LOCK.UPDATE`
por fila); sigue sin existir un helper propio — si el patrón se repite una
tercera vez, ahí sí extraerlo.

`DashboardShell.tsx` (`SECCIONES`) y los botones de acción de cada página
todavía no ocultan nada según el rol del usuario logueado (`personal.roles`
ya está disponible ahí) — falta aplicarlo cuando se agreguen pantallas que
la spec marca como solo Administrador (planes, personal, anulaciones).
