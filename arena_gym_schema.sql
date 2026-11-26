-- =====================================================================
-- ARENA GYM - Esquema de base de datos limpio (PostgreSQL 14+ / Supabase)
-- Proyecto de Grado: sistema web-movil con IA para gestion administrativa,
-- atencion al cliente (Telegram + Gemini) y seguimiento fisico.
--
-- Principios de diseno
--  * Solo lo que el perfil de proyecto exige (22 tablas, 3 vistas, 4 funciones-trigger).
--  * Reglas de negocio criticas dentro de la BD y VERSIONADAS en este archivo
--    (fecha_fin, jornada abierta, consentimiento, auditoria).
--  * Borrado logico: nada se elimina; toda anulacion exige motivo + auditoria.
--  * El chatbot NO se vincula a clientes (no accede a datos personales).
--  * Fechas de negocio en hora Bolivia (America/La_Paz); timestamps en timestamptz.
--  * Todo lo que NO esta aqui queda fuera de alcance: contabilidad formal
--    (libro diario/mayor, balances, impuestos, reparto a socios, control de fondos/banco
--    despues del cierre de caja), fotos/IA corporal.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. DOMINIOS (listas cerradas reutilizables; ALTER DOMAIN para ampliarlas)
-- ---------------------------------------------------------------------
CREATE DOMAIN d_canal_cobro AS VARCHAR(15)
  CHECK (VALUE IN ('EFECTIVO','QR','TRANSFERENCIA','TARJETA'));

-- Categorias tomadas de la hoja EGRESOS del Excel actual del gimnasio.
-- RETIRO_EFECTIVO = efectivo que sale de la caja al cerrar (deposito al banco o entrega al dueno);
-- sirve para que el arqueo cuadre y NO cuenta como gasto en el resultado mensual.
CREATE DOMAIN d_categoria AS VARCHAR(25)
  CHECK (VALUE IN (
    'SUELDOS','ALQUILER','AGUA','ENERGIA','INTERNET','MANTENIMIENTO','LIMPIEZA',
    'OFICINA','EQUIPAMIENTO','PUBLICIDAD','EVENTOS','IMPUESTOS',
    'OTROS_EGRESOS','OTROS_INGRESOS',
    'RETIRO_EFECTIVO'));

-- Hoy en Bolivia (las fechas de negocio no deben depender de la zona del servidor).
CREATE FUNCTION hoy_bolivia() RETURNS DATE
  LANGUAGE SQL STABLE AS $$ SELECT (now() AT TIME ZONE 'America/La_Paz')::date $$;

-- ---------------------------------------------------------------------
-- 1. ACCESO Y PERSONAS
-- ---------------------------------------------------------------------

-- Personal del gimnasio (GA: gestionar personal). Una persona puede tener
-- varios roles (ej. recepcionista que tambien es entrenador).
-- ADMIN hereda los permisos de RECEPCION (se resuelve en la API, no aqui).
CREATE TABLE personal (
  id_personal    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         VARCHAR(80)  NOT NULL,
  apellido       VARCHAR(80)  NOT NULL,
  usuario        VARCHAR(40)  NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,                 -- bcrypt
  telefono       VARCHAR(20),
  roles          TEXT[]       NOT NULL,
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_acceso  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_personal_roles CHECK (
    cardinality(roles) > 0
    AND roles <@ ARRAY['ADMIN','RECEPCION','ENTRENADOR']::TEXT[])
);

-- Clientes (usuarios de la app movil). Alta SIEMPRE por personal; el cliente
-- solo activa su cuenta (password_hash NULL = cuenta aun no activada).
-- Telefono unico entre clientes activos => login y activacion sin ambiguedad.
CREATE TABLE clientes (
  id_cliente             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                 VARCHAR(80)  NOT NULL,
  apellido               VARCHAR(80)  NOT NULL,
  telefono               VARCHAR(20)  NOT NULL,
  email                  VARCHAR(120),
  fecha_nacimiento       DATE         NOT NULL,         -- la API valida mayoria de edad (18+)
  foto_perfil_url        TEXT,                          -- Supabase Storage
  password_hash          VARCHAR(100),                  -- bcrypt; NULL hasta activar cuenta
  fcm_token              TEXT,                          -- push opcional (Firebase)
  -- Consentimiento informado (SF-17): exigido por trigger para evaluar / proponer rutina
  consentimiento_at          TIMESTAMPTZ,
  consentimiento_version     VARCHAR(20),
  consentimiento_revocado_at TIMESTAMPTZ,
  ultimo_acceso          TIMESTAMPTZ,
  activo                 BOOLEAN      NOT NULL DEFAULT TRUE,
  registrado_por         INTEGER      NOT NULL REFERENCES personal(id_personal),
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_clientes_telefono CHECK (telefono ~ '^[0-9]{7,15}$'),
  CONSTRAINT chk_clientes_consent  CHECK ((consentimiento_at IS NULL) = (consentimiento_version IS NULL))
);
CREATE UNIQUE INDEX uq_clientes_telefono_activo ON clientes (telefono) WHERE activo;
CREATE UNIQUE INDEX uq_clientes_email_activo    ON clientes (lower(email)) WHERE activo AND email IS NOT NULL;

-- ---------------------------------------------------------------------
-- 2. CATALOGOS
-- ---------------------------------------------------------------------

-- Planes de membresia (GA: gestionar planes). Ej.: Sesion (1 dia), Semanal (7), Mensual (30).
CREATE TABLE membresias (
  id_membresia       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre             VARCHAR(60)  NOT NULL UNIQUE,
  descripcion        TEXT,
  duracion_dias      INTEGER      NOT NULL CHECK (duracion_dias > 0),
  precio             NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  limite_asistencias INTEGER      CHECK (limite_asistencias > 0),   -- NULL = ilimitado
  activo             BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Catalogo de maquinas: fuente de datos del chatbot (AC-02) y de las rutinas.
CREATE TABLE maquinas (
  id_maquina     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         VARCHAR(80) NOT NULL UNIQUE,
  grupo_muscular VARCHAR(40) NOT NULL,
  descripcion    TEXT,
  imagen_url     TEXT,                                   -- Supabase Storage
  operativa      BOOLEAN NOT NULL DEFAULT TRUE,          -- falla temporal: no se ofrece
  activo         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE productos (
  id_producto      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre           VARCHAR(80)  NOT NULL UNIQUE,
  precio           NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  stock            INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0),
  precio_mayoreo   NUMERIC(10,2),
  cantidad_mayoreo INTEGER,
  activo           BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_prod_mayoreo_par   CHECK ((precio_mayoreo IS NULL) = (cantidad_mayoreo IS NULL)),
  CONSTRAINT chk_prod_mayoreo_cant  CHECK (cantidad_mayoreo IS NULL OR cantidad_mayoreo >= 2),
  CONSTRAINT chk_prod_mayoreo_menor CHECK (precio_mayoreo IS NULL OR precio_mayoreo < precio)
);

-- ---------------------------------------------------------------------
-- 3. CAJA DEL DIA (jornada) Y FINANZAS
-- ---------------------------------------------------------------------

-- Jornada de caja (GA: abrir/cerrar). UNA sola abierta a la vez; los cobros
-- de todos los canales cuelgan de ella (reemplaza las "cajas por nombre").
CREATE TABLE jornadas_caja (
  id_jornada            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estado                VARCHAR(10)  NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA','CERRADA')),
  fecha_apertura        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  id_personal_apertura  INTEGER      NOT NULL REFERENCES personal(id_personal),
  saldo_inicial_efectivo NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial_efectivo >= 0),
  -- arqueo al cierre (la diferencia se registra, no bloquea el cierre)
  fecha_cierre          TIMESTAMPTZ,
  id_personal_cierre    INTEGER REFERENCES personal(id_personal),
  efectivo_esperado     NUMERIC(10,2),
  efectivo_contado      NUMERIC(10,2) CHECK (efectivo_contado >= 0),
  diferencia            NUMERIC(10,2),
  observaciones         TEXT,
  CONSTRAINT chk_jornada_cierre CHECK (
    (estado = 'ABIERTA' AND fecha_cierre IS NULL)
    OR (estado = 'CERRADA' AND fecha_cierre IS NOT NULL AND id_personal_cierre IS NOT NULL
        AND efectivo_esperado IS NOT NULL AND efectivo_contado IS NOT NULL AND diferencia IS NOT NULL))
);
CREATE UNIQUE INDEX uq_jornada_abierta ON jornadas_caja (estado) WHERE estado = 'ABIERTA';

-- ---------------------------------------------------------------------
-- 4. MEMBRESIAS, PAGOS, VENTAS, ASISTENCIAS
-- ---------------------------------------------------------------------
-- Patron de anulacion (aplicado a las 5 tablas con dinero/asistencia):
--   anulado + motivo_anulacion + anulado_por + anulado_at  => evento en `auditoria` (trigger).

-- Inscripcion real cliente <-> plan. Copia precio/limite/duracion del plan al comprar.
CREATE TABLE registro_membresias (
  id_registro        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente         INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_membresia       INTEGER NOT NULL REFERENCES membresias(id_membresia),
  fecha_inicio       DATE    NOT NULL DEFAULT hoy_bolivia(),
  fecha_fin          DATE    NOT NULL,                  -- la fija el trigger (inicio + duracion - 1)
  precio             NUMERIC(10,2) NOT NULL,            -- snapshot del plan (el trigger lo copia si viene NULL)
  limite_asistencias INTEGER CHECK (limite_asistencias > 0),  -- snapshot del plan
  registrado_por     INTEGER NOT NULL REFERENCES personal(id_personal),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  anulado            BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion   TEXT,
  anulado_por        INTEGER REFERENCES personal(id_personal),
  anulado_at         TIMESTAMPTZ,
  CONSTRAINT chk_reg_fechas  CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT chk_reg_precio  CHECK (precio >= 0),
  CONSTRAINT chk_reg_anul    CHECK (NOT anulado OR (motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_at IS NOT NULL))
);
CREATE INDEX ix_reg_cliente_fin ON registro_membresias (id_cliente, fecha_fin DESC);
CREATE INDEX ix_reg_fin_vigente ON registro_membresias (fecha_fin) WHERE NOT anulado;

-- Pagos de membresia. Pago mixto = varias filas con el mismo id_grupo_pago.
CREATE TABLE pagos (
  id_pago          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_registro      INTEGER NOT NULL REFERENCES registro_membresias(id_registro),
  id_jornada       INTEGER NOT NULL REFERENCES jornadas_caja(id_jornada),
  id_grupo_pago    UUID,
  monto            NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  canal_cobro      d_canal_cobro NOT NULL,
  fecha_pago       TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_personal      INTEGER NOT NULL REFERENCES personal(id_personal),
  observaciones    TEXT,
  anulado          BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion TEXT,
  anulado_por      INTEGER REFERENCES personal(id_personal),
  anulado_at       TIMESTAMPTZ,
  CONSTRAINT chk_pagos_anul CHECK (NOT anulado OR (motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_at IS NOT NULL))
);
CREATE INDEX ix_pagos_registro ON pagos (id_registro);
CREATE INDEX ix_pagos_jornada  ON pagos (id_jornada);

-- Ventas de productos (precio por mayor decidido por la API desde `productos`).
CREATE TABLE ventas (
  id_venta         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_jornada       INTEGER NOT NULL REFERENCES jornadas_caja(id_jornada),
  id_cliente       INTEGER REFERENCES clientes(id_cliente),       -- opcional (venta al paso)
  canal_cobro      d_canal_cobro NOT NULL,
  total            NUMERIC(10,2) NOT NULL CHECK (total > 0),      -- = SUM(detalle_ventas.subtotal), lo calcula la API
  fecha_venta      TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_personal      INTEGER NOT NULL REFERENCES personal(id_personal),
  anulado          BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion TEXT,
  anulado_por      INTEGER REFERENCES personal(id_personal),
  anulado_at       TIMESTAMPTZ,
  CONSTRAINT chk_ventas_anul CHECK (NOT anulado OR (motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_at IS NOT NULL))
);
CREATE INDEX ix_ventas_jornada ON ventas (id_jornada);

CREATE TABLE detalle_ventas (
  id_detalle      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta        INTEGER NOT NULL REFERENCES ventas(id_venta),
  id_producto     INTEGER NOT NULL REFERENCES productos(id_producto),
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  es_mayoreo      BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);
CREATE INDEX ix_detalle_venta ON detalle_ventas (id_venta);

-- Ingresos/egresos manuales en EFECTIVO durante la jornada (ej. compra de limpieza de la caja).
-- Pagos y ventas NO se duplican aqui: el resumen de la jornada los suma desde su tabla.
CREATE TABLE movimientos_caja (
  id_movimiento    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_jornada       INTEGER NOT NULL REFERENCES jornadas_caja(id_jornada),
  tipo             VARCHAR(7) NOT NULL CHECK (tipo IN ('INGRESO','EGRESO')),
  categoria        d_categoria NOT NULL,
  monto            NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  concepto         TEXT NOT NULL,
  fecha_hora       TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_personal      INTEGER NOT NULL REFERENCES personal(id_personal),
  anulado          BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion TEXT,
  anulado_por      INTEGER REFERENCES personal(id_personal),
  anulado_at       TIMESTAMPTZ,
  CONSTRAINT chk_movcaja_anul CHECK (NOT anulado OR (motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_at IS NOT NULL))
);
CREATE INDEX ix_movcaja_jornada ON movimientos_caja (id_jornada);

-- Asistencia: registrada por personal (escanea el QR del cliente o manual).
-- `fecha` (dia Bolivia) es generada y habilita el UNIQUE "una asistencia por dia".
CREATE TABLE asistencias (
  id_asistencia    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente       INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_registro      INTEGER NOT NULL REFERENCES registro_membresias(id_registro),
  fecha_hora       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha            DATE GENERATED ALWAYS AS ((fecha_hora AT TIME ZONE 'America/La_Paz')::date) STORED,
  metodo           VARCHAR(7) NOT NULL CHECK (metodo IN ('QR','MANUAL')),
  id_personal      INTEGER NOT NULL REFERENCES personal(id_personal),
  anulado          BOOLEAN NOT NULL DEFAULT FALSE,
  motivo_anulacion TEXT,
  anulado_por      INTEGER REFERENCES personal(id_personal),
  anulado_at       TIMESTAMPTZ,
  CONSTRAINT chk_asist_anul CHECK (NOT anulado OR (motivo_anulacion IS NOT NULL AND anulado_por IS NOT NULL AND anulado_at IS NOT NULL))
);
CREATE UNIQUE INDEX uq_asistencia_dia ON asistencias (id_cliente, fecha) WHERE NOT anulado;
CREATE INDEX ix_asistencia_registro ON asistencias (id_registro) WHERE NOT anulado;

-- ---------------------------------------------------------------------
-- 5. SEGUIMIENTO FISICO Y RUTINAS (app movil)
-- ---------------------------------------------------------------------

-- Evaluacion manual (balanza + cinta metrica) registrada por el entrenador.
-- Campos de medida opcionales ("segun el enfoque del cliente"); al menos uno obligatorio.
-- enfoque / dias / minutos / restricciones alimentan el perfil SIN identificacion para Gemini.
CREATE TABLE evaluaciones (
  id_evaluacion      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente         INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_entrenador      INTEGER NOT NULL REFERENCES personal(id_personal),
  fecha              DATE    NOT NULL DEFAULT hoy_bolivia(),
  peso_kg            NUMERIC(5,2) CHECK (peso_kg > 0),
  altura_cm          NUMERIC(5,2) CHECK (altura_cm > 0),
  pecho_cm           NUMERIC(5,2) CHECK (pecho_cm > 0),
  cintura_cm         NUMERIC(5,2) CHECK (cintura_cm > 0),
  cadera_cm          NUMERIC(5,2) CHECK (cadera_cm > 0),
  brazo_cm           NUMERIC(5,2) CHECK (brazo_cm > 0),
  muslo_cm           NUMERIC(5,2) CHECK (muslo_cm > 0),
  enfoque            VARCHAR(20) CHECK (enfoque IN ('HIPERTROFIA','FUERZA','PERDIDA_GRASA','SALUD_GENERAL','OTRO')),
  dias_disponibles   SMALLINT    CHECK (dias_disponibles BETWEEN 1 AND 7),
  minutos_por_sesion SMALLINT    CHECK (minutos_por_sesion BETWEEN 15 AND 240),
  restricciones      TEXT,
  observaciones      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_eval_alguna_medida CHECK (
    num_nonnulls(peso_kg, altura_cm, pecho_cm, cintura_cm, cadera_cm, brazo_cm, muslo_cm) > 0)
);
CREATE INDEX ix_eval_cliente_fecha ON evaluaciones (id_cliente, fecha DESC);

-- Metas: vinculadas a una medida concreta (sin palabras clave en texto libre).
CREATE TABLE metas (
  id_meta        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente     INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_entrenador  INTEGER NOT NULL REFERENCES personal(id_personal),
  tipo_medida    VARCHAR(10) NOT NULL CHECK (tipo_medida IN ('PESO','CINTURA','CADERA','PECHO','BRAZO','MUSLO')),
  valor_inicial  NUMERIC(5,2) NOT NULL CHECK (valor_inicial > 0),
  valor_objetivo NUMERIC(5,2) NOT NULL CHECK (valor_objetivo > 0),
  valor_actual   NUMERIC(5,2) CHECK (valor_actual > 0),
  fecha_objetivo DATE,
  estado         VARCHAR(10) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','CUMPLIDA','CANCELADA')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_meta_distinta CHECK (valor_objetivo <> valor_inicial)
);
CREATE UNIQUE INDEX uq_meta_activa ON metas (id_cliente, tipo_medida) WHERE estado = 'ACTIVA';

-- Propuesta de rutina generada por Gemini (CU-17). Se guarda lo enviado y lo recibido
-- para poder auditar y evaluar con la rubrica (VD-8, VD-9).
CREATE TABLE propuestas_rutina (
  id_propuesta     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente       INTEGER NOT NULL REFERENCES clientes(id_cliente),   -- interno; NO se envia a Gemini
  id_evaluacion    INTEGER NOT NULL REFERENCES evaluaciones(id_evaluacion),
  id_solicitante   INTEGER NOT NULL REFERENCES personal(id_personal),
  estado           VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE'
                   CHECK (estado IN ('PENDIENTE','ACEPTADA','MODIFICADA','RECHAZADA','ERROR_IA')),
  perfil_enviado   JSONB NOT NULL,        -- PerfilSinIdentificacion (sin nombre, CI ni telefono)
  respuesta_ia     JSONB,                 -- salida estructurada de Gemini ya validada
  modelo_ia        VARCHAR(50),
  motivo_rechazo   TEXT,
  id_revisor       INTEGER REFERENCES personal(id_personal),
  fecha_solicitud  TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_revision   TIMESTAMPTZ,
  cumple_rubrica   BOOLEAN,               -- evaluacion del proyecto (VD-8)
  puntaje_rubrica  NUMERIC(2,1) CHECK (puntaje_rubrica BETWEEN 1 AND 5),   -- VD-9
  CONSTRAINT chk_prop_sin_identidad CHECK (NOT (perfil_enviado ?| ARRAY['nombre','apellido','ci','telefono','email','id_cliente'])),
  CONSTRAINT chk_prop_rechazo CHECK (estado <> 'RECHAZADA' OR motivo_rechazo IS NOT NULL),
  CONSTRAINT chk_prop_revision CHECK (estado IN ('PENDIENTE','ERROR_IA') OR (id_revisor IS NOT NULL AND fecha_revision IS NOT NULL))
);
CREATE INDEX ix_prop_estado ON propuestas_rutina (estado, fecha_solicitud DESC);

-- Rutina asignada (manual o desde una propuesta revisada).
CREATE TABLE rutinas (
  id_rutina     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente    INTEGER NOT NULL REFERENCES clientes(id_cliente),
  id_entrenador INTEGER NOT NULL REFERENCES personal(id_personal),
  nombre        VARCHAR(80) NOT NULL,
  objetivo      VARCHAR(120),
  origen        VARCHAR(12) NOT NULL CHECK (origen IN ('MANUAL','IA_REVISADA')),
  id_propuesta  INTEGER UNIQUE REFERENCES propuestas_rutina(id_propuesta),
  estado        VARCHAR(10) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','ARCHIVADA')),
  fecha_inicio  DATE NOT NULL DEFAULT hoy_bolivia(),
  fecha_fin     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rutina_origen CHECK ((origen = 'IA_REVISADA') = (id_propuesta IS NOT NULL)),
  CONSTRAINT chk_rutina_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE UNIQUE INDEX uq_rutina_activa ON rutinas (id_cliente) WHERE estado = 'ACTIVA';

-- Items de la rutina: referencian una maquina del catalogo (ejercicio = texto opcional).
CREATE TABLE rutina_ejercicios (
  id_rutina_ejercicio INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_rutina     INTEGER NOT NULL REFERENCES rutinas(id_rutina) ON DELETE CASCADE,
  dia           SMALLINT NOT NULL CHECK (dia BETWEEN 1 AND 7),
  orden         SMALLINT NOT NULL CHECK (orden > 0),
  id_maquina    INTEGER NOT NULL REFERENCES maquinas(id_maquina),
  ejercicio     VARCHAR(100),
  series        SMALLINT NOT NULL CHECK (series BETWEEN 1 AND 10),
  repeticiones  SMALLINT NOT NULL CHECK (repeticiones BETWEEN 1 AND 100),
  descanso_seg  SMALLINT CHECK (descanso_seg BETWEEN 0 AND 600),
  notas         TEXT,
  UNIQUE (id_rutina, dia, orden)
);

-- Cumplimiento: lo que el cliente realmente hizo (el cliente se deduce de la rutina).
CREATE TABLE registros_cumplimiento (
  id_cumplimiento      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_rutina_ejercicio  INTEGER NOT NULL REFERENCES rutina_ejercicios(id_rutina_ejercicio),
  fecha                DATE NOT NULL DEFAULT hoy_bolivia(),
  series_realizadas    SMALLINT CHECK (series_realizadas >= 0),
  repeticiones_realizadas SMALLINT CHECK (repeticiones_realizadas >= 0),
  peso_usado_kg        NUMERIC(5,1) CHECK (peso_usado_kg >= 0),
  completado           BOOLEAN NOT NULL DEFAULT TRUE,
  observaciones        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_cumpl_item_fecha ON registros_cumplimiento (id_rutina_ejercicio, fecha DESC);

-- ---------------------------------------------------------------------
-- 6. NOTIFICACIONES (las crea el cron de vencimientos y la asignacion de rutina)
-- ---------------------------------------------------------------------
CREATE TABLE notificaciones (
  id_notificacion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente      INTEGER NOT NULL REFERENCES clientes(id_cliente),
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('VENCIMIENTO_PROXIMO','MEMBRESIA_VENCIDA','RUTINA_ASIGNADA')),
  titulo          VARCHAR(120) NOT NULL,
  mensaje         TEXT NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  clave_dedup     VARCHAR(80) UNIQUE,     -- ej. 'VENC-3D-<id_registro>': el cron es idempotente
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_cliente ON notificaciones (id_cliente, leida, created_at DESC);

-- ---------------------------------------------------------------------
-- 7. ATENCION AL CLIENTE (Telegram + Gemini)
-- ---------------------------------------------------------------------
CREATE TABLE conversaciones (
  id_conversacion      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canal                VARCHAR(10) NOT NULL DEFAULT 'TELEGRAM' CHECK (canal IN ('TELEGRAM')),   -- WhatsApp: ampliacion futura
  chat_id              BIGINT NOT NULL,
  estado               VARCHAR(20) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','ESPERANDO_PERSONAL','CERRADA')),
  motivo_derivacion    TEXT,
  fecha_derivacion     TIMESTAMPTZ,
  id_personal_atiende  INTEGER REFERENCES personal(id_personal),
  fecha_inicio         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_ultimo_mensaje TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canal, chat_id),
  CONSTRAINT chk_conv_derivacion CHECK (estado <> 'ESPERANDO_PERSONAL' OR fecha_derivacion IS NOT NULL)
);
CREATE INDEX ix_conv_pendientes ON conversaciones (fecha_derivacion) WHERE estado = 'ESPERANDO_PERSONAL';

CREATE TABLE mensajes (
  id_mensaje         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_conversacion    INTEGER NOT NULL REFERENCES conversaciones(id_conversacion),
  emisor             VARCHAR(8) NOT NULL CHECK (emisor IN ('CLIENTE','BOT','PERSONAL')),
  id_personal        INTEGER REFERENCES personal(id_personal),
  contenido          TEXT NOT NULL,
  telegram_update_id BIGINT UNIQUE,        -- deduplica reintentos de Telegram
  entregado          BOOLEAN NOT NULL DEFAULT TRUE,   -- la API inserta BOT/PERSONAL en FALSE y confirma tras sendMessage
  fuente             VARCHAR(5) CHECK (fuente IN ('IA','MENU')),   -- solo BOT: respuesta de Gemini o menu de respaldo
  tiempo_respuesta_ms INTEGER CHECK (tiempo_respuesta_ms >= 0),    -- VD-2
  fecha_hora         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_msg_personal CHECK ((emisor = 'PERSONAL') = (id_personal IS NOT NULL))
);
CREATE INDEX ix_msg_conv_fecha ON mensajes (id_conversacion, fecha_hora);

-- ---------------------------------------------------------------------
-- 8. AUDITORIA (una sola tabla para todas las entidades)
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
  id_auditoria     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entidad          VARCHAR(40) NOT NULL,
  id_entidad       INTEGER NOT NULL,
  accion           VARCHAR(10) NOT NULL CHECK (accion IN ('CREAR','EDITAR','ANULAR','REACTIVAR','CERRAR')),
  id_personal      INTEGER NOT NULL REFERENCES personal(id_personal),
  motivo           TEXT,
  datos_anteriores JSONB,
  datos_nuevos     JSONB,
  fecha_hora       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_aud_motivo CHECK (accion <> 'ANULAR' OR motivo IS NOT NULL)
);
CREATE INDEX ix_aud_entidad ON auditoria (entidad, id_entidad, fecha_hora DESC);

-- =====================================================================
-- FUNCIONES-TRIGGER (reglas que antes vivian fuera del control de versiones)
-- =====================================================================

-- T1. Inscripcion: copia precio/limite del plan y calcula fecha_fin (inicio + duracion - 1).
CREATE FUNCTION fn_registro_membresia_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m membresias%ROWTYPE;
BEGIN
  SELECT * INTO m FROM membresias WHERE id_membresia = NEW.id_membresia;
  IF NOT FOUND OR NOT m.activo THEN
    RAISE EXCEPTION 'Plan de membresia % inexistente o inactivo', NEW.id_membresia;
  END IF;
  NEW.fecha_fin := NEW.fecha_inicio + (m.duracion_dias - 1);
  NEW.precio := COALESCE(NEW.precio, m.precio);
  NEW.limite_asistencias := m.limite_asistencias;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_registro_snapshot BEFORE INSERT ON registro_membresias
  FOR EACH ROW EXECUTE FUNCTION fn_registro_membresia_snapshot();

-- T2. Pagos, ventas y movimientos de caja solo entran en una jornada ABIERTA.
CREATE FUNCTION fn_exigir_jornada_abierta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jornadas_caja WHERE id_jornada = NEW.id_jornada AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'La jornada % no esta abierta', NEW.id_jornada;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pagos_jornada BEFORE INSERT ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_jornada_abierta();
CREATE TRIGGER trg_ventas_jornada BEFORE INSERT ON ventas
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_jornada_abierta();
CREATE TRIGGER trg_movcaja_jornada BEFORE INSERT ON movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_jornada_abierta();

-- T4. Sin consentimiento vigente no hay evaluacion ni propuesta de IA (SF-17).
CREATE FUNCTION fn_exigir_consentimiento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clientes
                  WHERE id_cliente = NEW.id_cliente
                    AND consentimiento_at IS NOT NULL
                    AND consentimiento_revocado_at IS NULL) THEN
    RAISE EXCEPTION 'El cliente % no tiene consentimiento informado vigente', NEW.id_cliente;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_eval_consent BEFORE INSERT ON evaluaciones
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_consentimiento();
CREATE TRIGGER trg_prop_consent BEFORE INSERT ON propuestas_rutina
  FOR EACH ROW EXECUTE FUNCTION fn_exigir_consentimiento();

-- T5. Toda anulacion genera su evento de auditoria (motivo obligatorio por CHECK).
--     TG_ARGV[0] = nombre de la columna PK de la tabla.
CREATE FUNCTION fn_auditar_anulacion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT OLD.anulado AND NEW.anulado THEN
    INSERT INTO auditoria (entidad, id_entidad, accion, id_personal, motivo, datos_anteriores, datos_nuevos)
    VALUES (TG_TABLE_NAME, (to_jsonb(NEW) ->> TG_ARGV[0])::INTEGER, 'ANULAR',
            NEW.anulado_por, NEW.motivo_anulacion, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_aud_registro AFTER UPDATE ON registro_membresias FOR EACH ROW EXECUTE FUNCTION fn_auditar_anulacion('id_registro');
CREATE TRIGGER trg_aud_pagos    AFTER UPDATE ON pagos               FOR EACH ROW EXECUTE FUNCTION fn_auditar_anulacion('id_pago');
CREATE TRIGGER trg_aud_ventas   AFTER UPDATE ON ventas             FOR EACH ROW EXECUTE FUNCTION fn_auditar_anulacion('id_venta');
CREATE TRIGGER trg_aud_movcaja  AFTER UPDATE ON movimientos_caja   FOR EACH ROW EXECUTE FUNCTION fn_auditar_anulacion('id_movimiento');
CREATE TRIGGER trg_aud_asist    AFTER UPDATE ON asistencias        FOR EACH ROW EXECUTE FUNCTION fn_auditar_anulacion('id_asistencia');

-- =====================================================================
-- VISTAS (solo lectura; no son tablas adicionales)
-- =====================================================================

-- Membresias vigentes con dias restantes y accesos usados (para QR, alertas y app).
CREATE VIEW v_membresias_vigentes AS
SELECT r.id_registro, r.id_cliente, c.nombre, c.apellido, c.telefono,
       m.nombre AS plan, r.fecha_inicio, r.fecha_fin,
       (r.fecha_fin - hoy_bolivia()) AS dias_restantes,
       r.limite_asistencias,
       (SELECT count(*) FROM asistencias a WHERE a.id_registro = r.id_registro AND NOT a.anulado) AS asistencias_usadas
  FROM registro_membresias r
  JOIN clientes c    ON c.id_cliente = r.id_cliente AND c.activo
  JOIN membresias m  ON m.id_membresia = r.id_membresia
 WHERE NOT r.anulado AND r.fecha_fin >= hoy_bolivia();

-- Resumen de cada jornada: ingresos por canal y efectivo esperado para el arqueo.
CREATE VIEW v_jornada_resumen AS
WITH ing AS (
  SELECT id_jornada, canal_cobro, monto FROM pagos  WHERE NOT anulado
  UNION ALL
  SELECT id_jornada, canal_cobro, total FROM ventas WHERE NOT anulado
), ing_j AS (
  SELECT id_jornada,
         COALESCE(sum(monto) FILTER (WHERE canal_cobro = 'EFECTIVO'),0)      AS ingresos_efectivo,
         COALESCE(sum(monto) FILTER (WHERE canal_cobro = 'QR'),0)            AS ingresos_qr,
         COALESCE(sum(monto) FILTER (WHERE canal_cobro = 'TRANSFERENCIA'),0) AS ingresos_transferencia,
         COALESCE(sum(monto) FILTER (WHERE canal_cobro = 'TARJETA'),0)       AS ingresos_tarjeta
    FROM ing GROUP BY id_jornada
), mov AS (
  SELECT id_jornada,
         COALESCE(sum(monto) FILTER (WHERE tipo = 'INGRESO'),0) AS otros_ingresos_efectivo,
         COALESCE(sum(monto) FILTER (WHERE tipo = 'EGRESO'),0)  AS egresos_efectivo
    FROM movimientos_caja WHERE NOT anulado GROUP BY id_jornada
)
SELECT j.id_jornada, j.estado, j.fecha_apertura, j.fecha_cierre, j.saldo_inicial_efectivo,
       COALESCE(i.ingresos_efectivo,0)      AS ingresos_efectivo,
       COALESCE(i.ingresos_qr,0)            AS ingresos_qr,
       COALESCE(i.ingresos_transferencia,0) AS ingresos_transferencia,
       COALESCE(i.ingresos_tarjeta,0)       AS ingresos_tarjeta,
       COALESCE(m.otros_ingresos_efectivo,0) AS otros_ingresos_efectivo,
       COALESCE(m.egresos_efectivo,0)        AS egresos_efectivo,
       j.saldo_inicial_efectivo + COALESCE(i.ingresos_efectivo,0)
         + COALESCE(m.otros_ingresos_efectivo,0) - COALESCE(m.egresos_efectivo,0) AS efectivo_esperado_calculado,
       j.efectivo_contado, j.diferencia
  FROM jornadas_caja j
  LEFT JOIN ing_j i ON i.id_jornada = j.id_jornada
  LEFT JOIN mov   m ON m.id_jornada = j.id_jornada;

-- Ingresos y egresos por mes y categoria: insumo para el estado de resultados del contador
-- (reemplaza el trabajo manual de las hojas VENTAS/EGRESOS del Excel; NO es contabilidad formal).
CREATE VIEW v_resultado_mensual AS
SELECT date_trunc('month', x.fecha)::date AS mes, x.tipo, x.categoria, sum(x.monto) AS total
  FROM (
    SELECT (fecha_pago  AT TIME ZONE 'America/La_Paz')::date AS fecha, 'INGRESO'::text AS tipo, 'MEMBRESIAS'::text AS categoria, monto
      FROM pagos WHERE NOT anulado
    UNION ALL
    SELECT (fecha_venta AT TIME ZONE 'America/La_Paz')::date, 'INGRESO', 'VENTA_PRODUCTOS', total
      FROM ventas WHERE NOT anulado
    UNION ALL
    SELECT (fecha_hora  AT TIME ZONE 'America/La_Paz')::date, tipo, categoria::text, monto
      FROM movimientos_caja WHERE NOT anulado
  ) x
 WHERE x.categoria <> 'RETIRO_EFECTIVO'
 GROUP BY 1,2,3;

-- =====================================================================
-- DATOS INICIALES MINIMOS
-- =====================================================================
-- Planes: cargar con el dueno (precios reales). Ejemplo de forma:
-- INSERT INTO membresias (nombre,duracion_dias,precio) VALUES ('Sesion',1,10),('Mensual',30,60);
-- El primer usuario ADMIN se crea con un script aparte (hash bcrypt generado por la API).

COMMIT;
-- Requiere la extension pgcrypto (Supabase la trae habilitada por defecto;
-- si no, descomenta la siguiente linea)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO personal (nombre, apellido, usuario, password_hash, roles, activo)
VALUES
  ('Admin', 'Arena', 'admin', crypt('Admin123', gen_salt('bf')), ARRAY['ADMIN'], true),
  ('Recepcion', 'Arena', 'recepcion', crypt('Recepcion123', gen_salt('bf')), ARRAY['RECEPCION'], true),
  ('Entrenador', 'Arena', 'entrenador', crypt('Entrenador123', gen_salt('bf')), ARRAY['ENTRENADOR'], true)
ON CONFLICT (usuario) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      nombre        = EXCLUDED.nombre,
      apellido      = EXCLUDED.apellido,
      roles         = EXCLUDED.roles,
      activo        = true;
-- Requiere pgcrypto (Supabase la trae habilitada por defecto;
-- si no, descomenta la siguiente linea)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO personal (nombre, apellido, usuario, password_hash, roles, activo)
VALUES (
  'Daniel',                              -- nombre
  'Escobar',                             -- apellido
  'admin',                               -- usuario (login)
  crypt('Secreto123', gen_salt('bf')),   -- password en texto plano a hashear
  ARRAY['ADMIN'],                        -- roles: ADMIN | RECEPCION | ENTRENADOR (puede llevar varios)
  true                                   -- activo
)
ON CONFLICT (usuario) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      nombre        = EXCLUDED.nombre,
      apellido      = EXCLUDED.apellido,
      roles         = EXCLUDED.roles,
      activo        = true;
