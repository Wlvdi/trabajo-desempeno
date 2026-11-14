-- ==============================================================================
-- 02_triggers_automatizacion_y_auditoria.sql
-- Proyecto: Subligol
-- Descripción: Lógica procedural en PostgreSQL (PL/pgSQL):
--              - Actualización automática de stock en tiempo real.
--              - Generación automática de eventos en audit_logs.
--              - Blindaje estricto de inmutabilidad (impide UPDATE y DELETE en logs).
-- ==============================================================================

-- 1. TRIGGER: Actualización automática de timestamp 'updated_at' en productos
create or replace function fn_actualizar_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_productos_updated_at on productos;
create trigger trg_productos_updated_at
before update on productos
for each row
execute function fn_actualizar_updated_at();


-- 2. TRIGGER DE INMUTABILIDAD: Bloqueo de UPDATE y DELETE en audit_logs
-- Garantiza que ningún usuario, aplicación o script pueda alterar la historia
create or replace function fn_impedir_modificacion_logs()
returns trigger as $$
begin
    raise exception 'VIOLACIÓN DE INTEGRIDAD: Los registros de auditoría son inmutables y no pueden modificarse ni eliminarse.';
end;
$$ language plpgsql;

drop trigger if exists trg_bloquear_modificacion_audit_logs on audit_logs;
create trigger trg_bloquear_modificacion_audit_logs
before update or delete on audit_logs
for each row
execute function fn_impedir_modificacion_logs();


-- 3. TRIGGER: Entrada de mercadería por compras -> Suma stock y genera Log
create or replace function fn_procesar_detalle_compra()
returns trigger as $$
declare
    v_nombre_prod text;
    v_stock_previo integer;
    v_usuario_id uuid;
begin
    -- Obtener usuario responsable de la cabecera de la compra
    select usuario_id into v_usuario_id from compras where id = new.compra_id;

    -- Actualizar stock del producto y registrar stock previo
    update productos
    set stock_actual = stock_actual + new.cantidad,
        costo_unitario = new.costo_unitario,
        updated_at = now()
    where id = new.producto_id
    returning nombre, (stock_actual - new.cantidad) into v_nombre_prod, v_stock_previo;

    -- Registrar evento en audit_logs
    insert into audit_logs (
        usuario_id,
        tipo_evento,
        entidad_afectada,
        entidad_id,
        descripcion,
        detalle
    ) values (
        v_usuario_id,
        'COMPRA_ENTRADA',
        'productos',
        new.producto_id,
        'Ingreso de stock por compra: +' || new.cantidad || ' unid. de "' || coalesce(v_nombre_prod, 'Producto') || '" (Stock resultante: ' || (v_stock_previo + new.cantidad) || ')',
        jsonb_build_object(
            'compra_id', new.compra_id,
            'cantidad_ingresada', new.cantidad,
            'costo_unitario_ingresado', new.costo_unitario,
            'stock_anterior', v_stock_previo,
            'stock_nuevo', (v_stock_previo + new.cantidad)
        )
    );

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_after_detalle_compra on detalle_compras;
create trigger trg_after_detalle_compra
after insert on detalle_compras
for each row
execute function fn_procesar_detalle_compra();


-- 4. TRIGGER: Salida de mercadería por ventas -> Resta stock y genera Log
create or replace function fn_procesar_detalle_venta()
returns trigger as $$
declare
    v_nombre_prod text;
    v_stock_previo integer;
    v_canal text;
    v_usuario_id uuid;
begin
    -- Obtener canal y usuario responsable de la cabecera de la venta
    select canal_venta, usuario_id into v_canal, v_usuario_id from ventas where id = new.venta_id;

    -- Descontar stock del producto
    update productos
    set stock_actual = stock_actual - new.cantidad,
        updated_at = now()
    where id = new.producto_id
    returning nombre, (stock_actual + new.cantidad) into v_nombre_prod, v_stock_previo;

    -- Registrar evento en audit_logs
    insert into audit_logs (
        usuario_id,
        tipo_evento,
        entidad_afectada,
        entidad_id,
        descripcion,
        detalle
    ) values (
        v_usuario_id,
        'VENTA_SALIDA',
        'productos',
        new.producto_id,
        'Salida de stock por venta (' || coalesce(v_canal, 'Venta') || '): -' || new.cantidad || ' unid. de "' || coalesce(v_nombre_prod, 'Producto') || '" (Stock resultante: ' || (v_stock_previo - new.cantidad) || ')',
        jsonb_build_object(
            'venta_id', new.venta_id,
            'canal', v_canal,
            'cantidad_vendida', new.cantidad,
            'precio_unitario', new.precio_unitario,
            'stock_anterior', v_stock_previo,
            'stock_nuevo', (v_stock_previo - new.cantidad)
        )
    );

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_after_detalle_venta on detalle_ventas;
create trigger trg_after_detalle_venta
after insert on detalle_ventas
for each row
execute function fn_procesar_detalle_venta();


-- 5. TRIGGER: Registro de nuevo producto en auditoría
create or replace function fn_log_nuevo_producto()
returns trigger as $$
begin
    insert into audit_logs (
        tipo_evento,
        entidad_afectada,
        entidad_id,
        descripcion,
        detalle
    ) values (
        'CREACION_PRODUCTO',
        'productos',
        new.id,
        'Producto creado en catálogo: "' || new.nombre || '" (SKU: ' || coalesce(new.sku, 'S/SKU') || ', Temporada: ' || new.temporada || ')',
        jsonb_build_object(
            'sku', new.sku,
            'nombre', new.nombre,
            'temporada', new.temporada,
            'costo_unitario', new.costo_unitario,
            'precio_venta', new.precio_venta,
            'stock_inicial', new.stock_actual
        )
    );
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_after_insert_producto on productos;
create trigger trg_after_insert_producto
after insert on productos
for each row
execute function fn_log_nuevo_producto();
