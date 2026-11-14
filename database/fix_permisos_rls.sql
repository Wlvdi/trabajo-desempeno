-- ==============================================================================
-- fix_permisos_rls.sql
-- Ejecuta este script en el SQL Editor de Supabase para habilitar los permisos
-- a la clave pública anon (la que usa la aplicación web para operar).
-- ==============================================================================

-- 1. Eliminar políticas restrictivas previas
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

-- 2. Crear políticas que permitan acceso tanto con la clave anon como autenticados
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

-- 3. Políticas para audit_logs: lectura e inserción permitidas
create policy "Lectura audit_logs"
on audit_logs for select to anon, authenticated
using (true);

create policy "Insercion audit_logs"
on audit_logs for insert to anon, authenticated
with check (true);

-- NOTA: La inmutabilidad de audit_logs (prohibición de UPDATE y DELETE) 
-- se mantiene 100% blindada por el trigger fn_impedir_modificacion_logs() a nivel motor.
