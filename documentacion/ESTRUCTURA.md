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
  (`belongsTo`/`hasMany`).
- `listarPaginado.js` — helper compartido: pagina + busca por `ILIKE` sobre
  los campos que cada endpoint le indique. Todo endpoint de listado lo usa,
  en vez de reimplementar la paginación cada vez.

## `src/lib/auth/`
- `personalAuth.js` — firma (`firmarTokenPersonal`) y verifica
  (`verificarAuthPersonal`) el JWT del personal (staff: admin/recepción/
  entrenador), usando `jose` y el secreto `PERSONAL_JWT_SECRET`.
- Si más adelante se agrega login de clientes (app móvil), va en un archivo
  paralelo (`clienteAuth.js`) con su propio secreto.

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
(inscripciones, con `fecha_fin` calculada por trigger de la DB).

## Pendiente (próximas iteraciones, mismo patrón que arriba)
Jornadas de caja + Pagos + Ventas/Detalle + Movimientos de caja; Productos;
Asistencias; Máquinas; Evaluaciones/Metas/Propuestas de rutina/Rutinas+
ejercicios/Registros de cumplimiento; Notificaciones; Conversaciones+
Mensajes (Telegram); Auditoría (solo lectura); vistas `v_jornada_resumen` y
`v_resultado_mensual` (solo lectura). Para cada una: modelo en
`lib/db/models`, endpoint(s) en `app/api/<recurso>`, página en
`app/dashboard/<recurso>` con `DataTable`+`Modal`+`useCrudResource`, y
agregar la entrada correspondiente al array `SECCIONES` en
`dashboard/layout.tsx`.
