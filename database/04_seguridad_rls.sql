-- ==============================================================================
-- 04_seguridad_rls.sql
-- Proyecto: Subligol
-- Descripción: Políticas de seguridad a nivel de fila (Row Level Security - RLS).
--              - Permite acceso tanto a la clave pública de la app (anon)
--                como a usuarios autenticados.
--              - Protege estrictamente la inmutabilidad de audit_logs (solo SELECT e INSERT).
-- ==============================================================================

-- 1. Habilitar RLS en todas las tablas
alter table categorias enable row level security;
alter table productos enable row level security;
alter table compras enable row level security;
alter table detalle_compras enable row level security;
alter table ventas enable row level security;
alter table detalle_ventas enable row level security;
alter table audit_logs enable row level security;

-- 2. Limpieza de políticas previas (para permitir re-ejecuciones limpias)
drop policy if exists "Categorias: acceso para usuarios autenticados" on categorias;
drop policy if exists "Productos: acceso para usuarios autenticados" on productos;
drop policy if exists "Compras: acceso para usuarios autenticados" on compras;
drop policy if exists "Detalle Compras: acceso para usuarios autenticados" on detalle_compras;
drop policy if exists "Ventas: acceso para usuarios autenticados" on ventas;
drop policy if exists "Detalle Ventas: acceso para usuarios autenticados" on detalle_ventas;
drop policy if exists "Audit Logs: lectura permitida para usuarios autenticados" on audit_logs;
drop policy if exists "Audit Logs: insercion permitida para usuarios autenticados" on audit_logs;

drop policy if exists "Acceso categorias" on categorias;
drop policy if exists "Acceso productos" on productos;
drop policy if exists "Acceso compras" on compras;
drop policy if exists "Acceso detalle_compras" on detalle_compras;
drop policy if exists "Acceso ventas" on ventas;
drop policy if exists "Acceso detalle_ventas" on detalle_ventas;
drop policy if exists "Lectura audit_logs" on audit_logs;
drop policy if exists "Insercion audit_logs" on audit_logs;

-- 3. Políticas para Módulos Operativos (Categorías, Productos, Compras, Ventas)
create policy "Acceso categorias"
on categorias for all to anon, authenticated
using (true) with check (true);

create policy "Acceso productos"
on productos for all to anon, authenticated
using (true) with check (true);

create policy "Acceso compras"
on compras for all to anon, authenticated
using (true) with check (true);

create policy "Acceso detalle_compras"
on detalle_compras for all to anon, authenticated
using (true) with check (true);

create policy "Acceso ventas"
on ventas for all to anon, authenticated
using (true) with check (true);

create policy "Acceso detalle_ventas"
on detalle_ventas for all to anon, authenticated
using (true) with check (true);

-- 4. POLÍTICAS DE AUDIT LOGS (ESTRICTAMENTE DE SOLO LECTURA E INSERCIÓN)
-- Lectura permitida tanto a clave anon como a autenticados:
create policy "Lectura audit_logs"
on audit_logs for select to anon, authenticated
using (true);

-- Inserción permitida:
create policy "Insercion audit_logs"
on audit_logs for insert to anon, authenticated
with check (true);

-- NOTA CRÍTICA:
-- NO se definen políticas de UPDATE ni de DELETE para audit_logs.
-- Adicionalmente, el trigger de PostgreSQL impide de forma absoluta cualquier borrado o edición.
