-- ==============================================================================
-- test_verificacion_integridad.sql
-- Proyecto: Subligol
-- Descripción: Script de prueba para validar en Supabase SQL Editor:
--              1. Funcionamiento de triggers de stock en compras y ventas.
--              2. Generación automática de audit_logs.
--              3. Blindaje de inmutabilidad (UPDATE y DELETE en logs deben fallar).
--              4. Cálculo de vistas de dashboard.
-- ==============================================================================

-- PASO 1: Consultar estado inicial del producto 'TAZA-BLA-11'
select id, sku, nombre, stock_actual, costo_unitario
from productos
where sku = 'TAZA-BLA-11';
-- Resultado esperado: stock_actual = 36

-- PASO 2: Simular una COMPRA de 10 unidades
do $$
declare
    v_compra_id uuid;
    v_prod_id uuid;
begin
    select id into v_prod_id from productos where sku = 'TAZA-BLA-11';

    -- Crear cabecera de compra
    insert into compras (proveedor, total, notas)
    values ('Distribuidora Cerámicas Chile', 12000, 'Compra de prueba de reposición')
    returning id into v_compra_id;

    -- Insertar detalle -> Esto dispara trg_after_detalle_compra
    insert into detalle_compras (compra_id, producto_id, cantidad, costo_unitario, subtotal)
    values (v_compra_id, v_prod_id, 10, 1200, 12000);
end $$;

-- Verificar que el stock subió automáticamente a 46:
select sku, nombre, stock_actual
from productos
where sku = 'TAZA-BLA-11';


-- PASO 3: Simular una VENTA de 4 unidades por Instagram
do $$
declare
    v_venta_id uuid;
    v_prod_id uuid;
begin
    select id into v_prod_id from productos where sku = 'TAZA-BLA-11';

    -- Crear cabecera de venta
    insert into ventas (canal_venta, cliente_nombre, total, notas)
    values ('Instagram', 'Cliente Demo IG', 18000, 'Pedido directo por DM')
    returning id into v_venta_id;

    -- Insertar detalle -> Esto dispara trg_after_detalle_venta
    insert into detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    values (v_venta_id, v_prod_id, 4, 4500, 18000);
end $$;

-- Verificar que el stock bajó automáticamente de 46 a 42:
select sku, nombre, stock_actual
from productos
where sku = 'TAZA-BLA-11';


-- PASO 4: Consultar el historial de auditoría autogenerado
select fecha, tipo_evento, entidad_afectada, descripcion, detalle
from audit_logs
order by fecha desc
limit 5;


-- PASO 5: PRUEBA DE INMUTABILIDAD (¡ESTA SENTENCIA DEBE FALLAR CON ERROR!)
-- Si ejecutas la siguiente línea individualmente, PostgreSQL debe responder:
-- "ERROR: VIOLACIÓN DE INTEGRIDAD: Los registros de auditoría son inmutables..."
--
-- UPDATE audit_logs SET descripcion = 'Intento de hackeo o alteracion' WHERE id IS NOT NULL;
-- DELETE FROM audit_logs;


-- PASO 6: Consultar vistas de Dashboard
select * from vista_capital_inmovilizado;
select * from vista_productos_stock_critico;
select * from vista_balance_comercial;
select * from vista_ventas_por_canal;
