-- =============================================================================
-- 001_esquema_base.sql
-- Esquema base de Subligol adaptado desde Supabase (database/00_script_completo).
-- Cambios respecto del original:
--   * auth.users (Supabase) se reemplaza por la tabla propia `usuarios`.
--   * Se eliminan RLS y policies: el control de acceso lo hace la API.
--   * Se elimina uuid-ossp (gen_random_uuid() es nativo desde PostgreSQL 13).
--   * Solo se mantienen índices de claves primarias, únicas y foráneas
--     (más los de audit_logs, usados solo por el panel). La búsqueda de la
--     tienda parte SIN índices a propósito: se agregarán como mejora medible
--     en la Fase 2.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Usuarios (clientes de la tienda y administradores del panel)
-- -----------------------------------------------------------------------------
create table usuarios (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    nombre text not null,
    hash_contrasena text not null,
    rol text not null default 'cliente' check (rol in ('cliente', 'admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- El correo es único sin importar mayúsculas/minúsculas.
create unique index uq_usuarios_email on usuarios (lower(email));

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create table categorias (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    descripcion text,
    created_at timestamptz not null default now()
);

create table productos (
    id uuid primary key default gen_random_uuid(),
    sku text unique,
    nombre text not null,
    descripcion text,
    categoria_id uuid references categorias(id) on delete set null,
    temporada text not null default 'General',
    costo_unitario numeric(12, 2) not null default 0 check (costo_unitario >= 0),
    precio_venta numeric(12, 2) not null default 0 check (precio_venta >= 0),
    stock_actual integer not null default 0,
    stock_minimo integer not null default 5 check (stock_minimo >= 0),
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_productos_categoria on productos (categoria_id);

-- -----------------------------------------------------------------------------
-- Compras a proveedores (entradas de stock)
-- -----------------------------------------------------------------------------
create table compras (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    proveedor text,
    total numeric(12, 2) not null default 0 check (total >= 0),
    notas text,
    usuario_id uuid references usuarios(id) on delete set null,
    created_at timestamptz not null default now()
);

create table detalle_compras (
    id uuid primary key default gen_random_uuid(),
    compra_id uuid not null references compras(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete restrict,
    cantidad integer not null check (cantidad > 0),
    costo_unitario numeric(12, 2) not null check (costo_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

create index idx_detalle_compras_compra on detalle_compras (compra_id);
create index idx_detalle_compras_producto on detalle_compras (producto_id);

-- -----------------------------------------------------------------------------
-- Ventas (salidas de stock): canales manuales y la tienda web
-- -----------------------------------------------------------------------------
create table ventas (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    canal_venta text not null default 'Instagram'
        check (canal_venta in ('Instagram', 'WhatsApp', 'Presencial', 'Web', 'Otro')),
    cliente_nombre text,
    total numeric(12, 2) not null default 0 check (total >= 0),
    notas text,
    -- Usuario que registró la venta (administrador o el mismo cliente web).
    usuario_id uuid references usuarios(id) on delete set null,
    created_at timestamptz not null default now()
);

create table detalle_ventas (
    id uuid primary key default gen_random_uuid(),
    venta_id uuid not null references ventas(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete restrict,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

create index idx_detalle_ventas_venta on detalle_ventas (venta_id);
create index idx_detalle_ventas_producto on detalle_ventas (producto_id);

-- -----------------------------------------------------------------------------
-- Auditoría inmutable
-- -----------------------------------------------------------------------------
create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    usuario_id uuid references usuarios(id) on delete set null,
    usuario_email text,
    tipo_evento text not null,
    entidad_afectada text not null,
    entidad_id uuid,
    descripcion text not null,
    detalle jsonb,
    created_at timestamptz not null default now()
);

create index idx_audit_logs_fecha on audit_logs (fecha desc);
create index idx_audit_logs_tipo on audit_logs (tipo_evento);
create index idx_audit_logs_entidad on audit_logs (entidad_afectada, entidad_id);

-- =============================================================================
-- Funciones y triggers
-- =============================================================================

-- Mantiene updated_at al día.
create function fn_actualizar_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_productos_updated_at
before update on productos
for each row execute function fn_actualizar_updated_at();

create trigger trg_usuarios_updated_at
before update on usuarios
for each row execute function fn_actualizar_updated_at();

-- Usuario de la sesión actual. La API lo fija por transacción con
-- set_config('app.usuario_id', '<uuid>', true). Devuelve null si no está.
create function fn_usuario_sesion()
returns uuid as $$
    select nullif(current_setting('app.usuario_id', true), '')::uuid;
$$ language sql stable;

-- Bloquea UPDATE y DELETE en audit_logs.
create function fn_impedir_modificacion_logs()
returns trigger as $$
begin
    raise exception 'VIOLACIÓN DE INTEGRIDAD: Los registros de auditoría son inmutables y no pueden modificarse ni eliminarse.';
end;
$$ language plpgsql;

create trigger trg_bloquear_modificacion_audit_logs
before update or delete on audit_logs
for each row execute function fn_impedir_modificacion_logs();

-- Compra: suma stock, actualiza costo y registra auditoría.
create function fn_procesar_detalle_compra()
returns trigger as $$
declare
    v_nombre_prod text;
    v_stock_previo integer;
    v_usuario_id uuid;
begin
    select usuario_id into v_usuario_id from compras where id = new.compra_id;

    update productos
    set stock_actual = stock_actual + new.cantidad,
        costo_unitario = new.costo_unitario
    where id = new.producto_id
    returning nombre, (stock_actual - new.cantidad) into v_nombre_prod, v_stock_previo;

    insert into audit_logs (usuario_id, tipo_evento, entidad_afectada, entidad_id, descripcion, detalle)
    values (
        coalesce(v_usuario_id, fn_usuario_sesion()),
        'COMPRA_ENTRADA',
        'productos',
        new.producto_id,
        'Ingreso de stock por compra: +' || new.cantidad || ' unid. de "' || coalesce(v_nombre_prod, 'Producto')
            || '" (Stock resultante: ' || (v_stock_previo + new.cantidad) || ')',
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

create trigger trg_after_detalle_compra
after insert on detalle_compras
for each row execute function fn_procesar_detalle_compra();

-- Venta: descuenta stock y registra auditoría.
-- Si el stock no alcanza, la restricción ck_productos_stock_no_negativo
-- (migración 002) hace fallar la transacción completa.
create function fn_procesar_detalle_venta()
returns trigger as $$
declare
    v_nombre_prod text;
    v_stock_previo integer;
    v_canal text;
    v_usuario_id uuid;
begin
    select canal_venta, usuario_id into v_canal, v_usuario_id from ventas where id = new.venta_id;

    update productos
    set stock_actual = stock_actual - new.cantidad
    where id = new.producto_id
    returning nombre, (stock_actual + new.cantidad) into v_nombre_prod, v_stock_previo;

    insert into audit_logs (usuario_id, tipo_evento, entidad_afectada, entidad_id, descripcion, detalle)
    values (
        coalesce(v_usuario_id, fn_usuario_sesion()),
        'VENTA_SALIDA',
        'productos',
        new.producto_id,
        'Salida de stock por venta (' || coalesce(v_canal, 'Venta') || '): -' || new.cantidad || ' unid. de "'
            || coalesce(v_nombre_prod, 'Producto') || '" (Stock resultante: ' || (v_stock_previo - new.cantidad) || ')',
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

create trigger trg_after_detalle_venta
after insert on detalle_ventas
for each row execute function fn_procesar_detalle_venta();

-- Producto nuevo: registra auditoría.
create function fn_log_nuevo_producto()
returns trigger as $$
begin
    insert into audit_logs (usuario_id, tipo_evento, entidad_afectada, entidad_id, descripcion, detalle)
    values (
        fn_usuario_sesion(),
        'CREACION_PRODUCTO',
        'productos',
        new.id,
        'Producto creado en catálogo: "' || new.nombre || '" (SKU: ' || coalesce(new.sku, 'S/SKU')
            || ', Temporada: ' || new.temporada || ')',
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

create trigger trg_after_insert_producto
after insert on productos
for each row execute function fn_log_nuevo_producto();

-- =============================================================================
-- Vistas del panel de administración
-- =============================================================================

create view vista_capital_inmovilizado as
select
    count(id) as total_productos_activos,
    coalesce(sum(stock_actual), 0) as unidades_totales,
    coalesce(sum(stock_actual * costo_unitario), 0) as capital_inmovilizado_costo,
    coalesce(sum(stock_actual * precio_venta), 0) as valor_total_venta_estimado,
    coalesce(sum(stock_actual * (precio_venta - costo_unitario)), 0) as margen_bruto_potencial
from productos
where activo = true;

create view vista_productos_stock_critico as
select
    p.id,
    p.sku,
    p.nombre,
    c.nombre as categoria,
    p.temporada,
    p.stock_actual,
    p.stock_minimo,
    (p.stock_minimo - p.stock_actual) as deficit_unidades,
    case when p.stock_actual <= 0 then 'AGOTADO' else 'CRITICO' end as nivel_alerta
from productos p
left join categorias c on p.categoria_id = c.id
where p.activo = true
  and p.stock_actual <= p.stock_minimo
order by p.stock_actual asc;

create view vista_balance_comercial as
select
    coalesce((select sum(total) from compras), 0) as total_invertido_compras,
    coalesce((select sum(total) from ventas), 0) as total_recaudado_ventas,
    coalesce((select sum(total) from ventas), 0) - coalesce((select sum(total) from compras), 0) as balance_neto,
    (select count(*) from ventas) as cantidad_ventas_realizadas,
    (select count(*) from compras) as cantidad_compras_realizadas;

create view vista_ventas_por_canal as
select
    canal_venta,
    count(id) as cantidad_pedidos,
    coalesce(sum(total), 0) as total_ingresos
from ventas
group by canal_venta
order by total_ingresos desc;

create view vista_historial_auditoria as
select
    a.id,
    a.fecha,
    a.tipo_evento,
    a.entidad_afectada,
    a.descripcion,
    a.detalle,
    coalesce(u.email, a.usuario_email, 'Sistema') as usuario_responsable
from audit_logs a
left join usuarios u on a.usuario_id = u.id
order by a.fecha desc;
