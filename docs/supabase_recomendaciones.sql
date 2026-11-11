-- =====================================================================
-- Recomendaciones para la base de datos Supabase de Viajes UGR
-- NO se aplicaron automáticamente. Revisar y ejecutar manualmente en:
-- Supabase > SQL Editor. Hacer una copia de seguridad antes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Diagnóstico de seguridad (RLS)
--    La clave "anon" incluida en la aplicación es pública. Si RLS está
--    desactivado, cualquier persona con esa clave puede leer, modificar
--    y borrar registros directamente contra la API.
-- ---------------------------------------------------------------------
select relname as tabla, relrowsecurity as rls_activo
from pg_class where relname = 'actividades1';

select policyname, cmd, roles, qual, with_check
from pg_policies where tablename = 'actividades1';

-- ---------------------------------------------------------------------
-- 2. Índices para la paginación, el ordenamiento y los filtros que la
--    nueva interfaz ejecuta del lado del servidor
-- ---------------------------------------------------------------------
create index if not exists idx_actividades1_fecha_desde on public.actividades1 (fecha_desde desc, id);
create index if not exists idx_actividades1_viatico     on public.actividades1 (viatico);
create index if not exists idx_actividades1_permiso     on public.actividades1 (permiso);

-- Búsqueda por texto parcial (ILIKE '%término%') eficiente con trigramas
create extension if not exists pg_trgm;
create index if not exists idx_actividades1_actividad_trgm on public.actividades1 using gin (actividad gin_trgm_ops);
create index if not exists idx_actividades1_lugar_trgm     on public.actividades1 using gin (lugar gin_trgm_ops);
create index if not exists idx_actividades1_expediente_trgm on public.actividades1 using gin (numero_expediente gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 3. Validaciones en backend (complementan las del formulario)
--    Primero verificar cuántos registros existentes NO cumplirían:
-- ---------------------------------------------------------------------
select
  count(*) filter (where fecha_hasta < fecha_desde)                         as fechas_invertidas,
  count(*) filter (where km_final > 0 and km_inicial > 0 and km_final < km_inicial) as km_invertidos,
  count(*) filter (where monto < 0)                                         as montos_negativos,
  count(*) filter (where viatico not in ('Sí', 'No'))                       as viatico_invalido
from public.actividades1;

-- NOT VALID: se aplican a filas nuevas o modificadas sin bloquear por datos históricos.
alter table public.actividades1 add constraint chk_fechas  check (fecha_hasta >= fecha_desde) not valid;
alter table public.actividades1 add constraint chk_km      check (km_final = 0 or km_inicial = 0 or km_final >= km_inicial) not valid;
alter table public.actividades1 add constraint chk_monto   check (monto >= 0) not valid;
alter table public.actividades1 add constraint chk_viatico check (viatico in ('Sí', 'No')) not valid;
-- Cuando los datos históricos estén corregidos:
-- alter table public.actividades1 validate constraint chk_fechas;  (repetir por cada restricción)

-- ---------------------------------------------------------------------
-- 4. Observación de esquema
--    Existe la columna "viatico_cobrado", que la aplicación no usa
--    (usa "viatico"). No se elimina; evaluar si contiene datos históricos.
-- ---------------------------------------------------------------------
select count(*) filter (where viatico_cobrado is not null and viatico_cobrado <> '') as con_valor
from public.actividades1;
