-- ==============================================================================
-- 00_script_completo_subligol.sql
-- PROYECTO: SUBLIGOL - SISTEMA WEB DE GESTIÓN OPERATIVA
-- ==============================================================================
-- Este archivo contiene la configuración completa de la base de datos en un solo
-- script listo para copiar y pegar en el SQL Editor de Supabase.
--
-- Incluye:
-- 1. Extensiones y Tablas (Categorías, Productos con Temporadas, Compras, Ventas, Audit Logs)
-- 2. Triggers de Automatización de Stock en tiempo real
-- 3. Blindaje de Inmutabilidad para Audit Logs (impide UPDATE y DELETE)
-- 4. Vistas para Dashboard Comercial, Stock Crítico y Auditoría
-- 5. Políticas de Seguridad RLS
-- 6. Datos semilla de demostración
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PARTE 1: TABLAS Y EXTENSIONES
-- ------------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- Categorías
create table if not exists categorias (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    descripcion text,
    created_at timestamptz not null default now()
);

-- Productos (con rotación de temporadas)
create table if not exists productos (
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

create index if not exists idx_productos_sku on productos(sku);
create index if not exists idx_productos_categoria on productos(categoria_id);
create index if not exists idx_productos_temporada on productos(temporada);
create index if not exists idx_productos_activo on productos(activo);

-- Compras (Cabecera)
create table if not exists compras (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    proveedor text,
    total numeric(12, 2) not null default 0 check (total >= 0),
    notas text,
    usuario_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- Detalle de Compras (Entradas)
create table if not exists detalle_compras (
    id uuid primary key default gen_random_uuid(),
    compra_id uuid not null references compras(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete restrict,
    cantidad integer not null check (cantidad > 0),
    costo_unitario numeric(12, 2) not null check (costo_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

-- Ventas (Cabecera)
create table if not exists ventas (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    canal_venta text not null default 'Instagram' check (canal_venta in ('Instagram', 'WhatsApp', 'Presencial', 'Web', 'Otro')),
    cliente_nombre text,
    total numeric(12, 2) not null default 0 check (total >= 0),
    notas text,
    usuario_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- Detalle de Ventas (Salidas)
create table if not exists detalle_ventas (
    id uuid primary key default gen_random_uuid(),
    venta_id uuid not null references ventas(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete restrict,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

-- Historial de Auditoría Inmutable
create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    usuario_id uuid references auth.users(id) on delete set null,
    usuario_email text,
    tipo_evento text not null,
    entidad_afectada text not null,
    entidad_id uuid,
    descripcion text not null,
    detalle jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_fecha on audit_logs(fecha desc);
create index if not exists idx_audit_logs_tipo on audit_logs(tipo_evento);
create index if not exists idx_audit_logs_entidad on audit_logs(entidad_afectada, entidad_id);


-- ------------------------------------------------------------------------------
-- PARTE 2: FUNCIONES Y TRIGGERS DE AUTOMATIZACIÓN
-- ------------------------------------------------------------------------------

-- Timestamp de productos
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

-- BLINDAJE DE INMUTABILIDAD EN AUDIT_LOGS
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

-- Procesar compras: suma stock y loguea
create or replace function fn_procesar_detalle_compra()
returns trigger as $$
declare
    v_nombre_prod text;
    v_stock_previo integer;
    v_usuario_id uuid;
begin
    select usuario_id into v_usuario_id from compras where id = new.compra_id;

    update productos
    set stock_actual = stock_actual + new.cantidad,
        costo_unitario = new.costo_unitario,
        updated_at = now()
    where id = new.producto_id
    returning nombre, (stock_actual - new.cantidad) into v_nombre_prod, v_stock_previo;

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

-- Procesar ventas: descuenta stock y loguea
create or replace function fn_procesar_detalle_venta()
returns trigger as $$
declare
    v_nombre_prod text;
    v_stock_previo integer;
    v_canal text;
    v_usuario_id uuid;
begin
    select canal_venta, usuario_id into v_canal, v_usuario_id from ventas where id = new.venta_id;

    update productos
    set stock_actual = stock_actual - new.cantidad,
        updated_at = now()
    where id = new.producto_id
    returning nombre, (stock_actual + new.cantidad) into v_nombre_prod, v_stock_previo;

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

-- Log automático de nuevo producto
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


-- ------------------------------------------------------------------------------
-- PARTE 3: VISTAS DEL DASHBOARD, ALERTAS Y AUDITORÍA
-- ------------------------------------------------------------------------------

create or replace view vista_capital_inmovilizado as
select
    count(id) as total_productos_activos,
    coalesce(sum(stock_actual), 0) as unidades_totales,
    coalesce(sum(stock_actual * costo_unitario), 0) as capital_inmovilizado_costo,
    coalesce(sum(stock_actual * precio_venta), 0) as valor_total_venta_estimado,
    coalesce(sum(stock_actual * (precio_venta - costo_unitario)), 0) as margen_bruto_potencial
from productos
where activo = true;

create or replace view vista_productos_stock_critico as
select
    p.id,
    p.sku,
    p.nombre,
    c.nombre as categoria,
    p.temporada,
    p.stock_actual,
    p.stock_minimo,
    (p.stock_minimo - p.stock_actual) as deficit_unidades,
    case
        when p.stock_actual <= 0 then 'AGOTADO'
        else 'CRITICO'
    end as nivel_alerta
from productos p
left join categorias c on p.categoria_id = c.id
where p.activo = true
  and p.stock_actual <= p.stock_minimo
order by p.stock_actual asc;

create or replace view vista_balance_comercial as
select
    coalesce((select sum(total) from compras), 0) as total_invertido_compras,
    coalesce((select sum(total) from ventas), 0) as total_recaudado_ventas,
    (coalesce((select sum(total) from ventas), 0) - coalesce((select sum(total) from compras), 0)) as balance_neto,
    (select count(*) from ventas) as cantidad_ventas_realizadas,
    (select count(*) from compras) as cantidad_compras_realizadas;

create or replace view vista_ventas_por_canal as
select
    canal_venta,
    count(id) as cantidad_pedidos,
    coalesce(sum(total), 0) as total_ingresos
from ventas
group by canal_venta
order by total_ingresos desc;

create or replace view vista_historial_auditoria as
select
    a.id,
    a.fecha,
    a.tipo_evento,
    a.entidad_afectada,
    a.descripcion,
    a.detalle,
    coalesce(u.email, a.usuario_email, 'Sistema') as usuario_responsable
from audit_logs a
left join auth.users u on a.usuario_id = u.id
order by a.fecha desc;


-- ------------------------------------------------------------------------------
-- PARTE 4: POLÍTICAS DE SEGURIDAD ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
alter table categorias enable row level security;
alter table productos enable row level security;
alter table compras enable row level security;
alter table detalle_compras enable row level security;
alter table ventas enable row level security;
alter table detalle_ventas enable row level security;
alter table audit_logs enable row level security;

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

create policy "Acceso categorias"
on categorias for all to anon, authenticated using (true) with check (true);

create policy "Acceso productos"
on productos for all to anon, authenticated using (true) with check (true);

create policy "Acceso compras"
on compras for all to anon, authenticated using (true) with check (true);

create policy "Acceso detalle_compras"
on detalle_compras for all to anon, authenticated using (true) with check (true);

create policy "Acceso ventas"
on ventas for all to anon, authenticated using (true) with check (true);

create policy "Acceso detalle_ventas"
on detalle_ventas for all to anon, authenticated using (true) with check (true);

create policy "Lectura audit_logs"
on audit_logs for select to anon, authenticated using (true);

create policy "Insercion audit_logs"
on audit_logs for insert to anon, authenticated with check (true);


-- ------------------------------------------------------------------------------
-- PARTE 5: DATOS SEMILLA DE PRUEBA
-- ------------------------------------------------------------------------------
insert into categorias (nombre, descripcion)
values
    ('Tazas y Tazones', 'Tazas de cerámica, mágicas, polímero y vidrio esmerilado'),
    ('Poleras y Textiles', 'Poleras tacto algodón, polerones, tote bags y jockey'),
    ('Botellas y Shakers', 'Botellas de aluminio, térmicas y botellas deportivas'),
    ('Papelería y Regalos', 'Agendas personalizadas, llaveros, mousepads y puzzles'),
    ('Insumos y Blancos', 'Cajas para tazas, cintas térmicas y papel de sublimación')
on conflict (nombre) do nothing;

insert into productos (sku, nombre, descripcion, categoria_id, temporada, costo_unitario, precio_venta, stock_actual, stock_minimo, activo)
select
    'TAZA-BLA-11',
    'Taza Cerámica Blanca 11oz',
    'Taza estándar sublimable calidad AAA',
    (select id from categorias where nombre = 'Tazas y Tazones'),
    'General',
    1200,
    4500,
    36,
    10,
    true
where not exists (select 1 from productos where sku = 'TAZA-BLA-11');

insert into productos (sku, nombre, descripcion, categoria_id, temporada, costo_unitario, precio_venta, stock_actual, stock_minimo, activo)
select
    'TAZA-MAG-11',
    'Taza Mágica Negra 11oz',
    'Revela imagen con líquido caliente',
    (select id from categorias where nombre = 'Tazas y Tazones'),
    'Día de la Madre',
    2200,
    7500,
    4,
    8,
    true
where not exists (select 1 from productos where sku = 'TAZA-MAG-11');

insert into productos (sku, nombre, descripcion, categoria_id, temporada, costo_unitario, precio_venta, stock_actual, stock_minimo, activo)
select
    'POL-BLA-M',
    'Polera Tacto Algodón Blanca Talla M',
    'Polera 100% poliéster tacto suave',
    (select id from categorias where nombre = 'Poleras y Textiles'),
    'General',
    2800,
    8990,
    15,
    5,
    true
where not exists (select 1 from productos where sku = 'POL-BLA-M');

insert into productos (sku, nombre, descripcion, categoria_id, temporada, costo_unitario, precio_venta, stock_actual, stock_minimo, activo)
select
    'BOT-ALU-600',
    'Botella Deportiva Aluminio 600ml Plateada',
    'Con mosquetón para mochilas escolares',
    (select id from categorias where nombre = 'Botellas y Shakers'),
    'Escolar',
    2500,
    6990,
    20,
    6,
    true
where not exists (select 1 from productos where sku = 'BOT-ALU-600');

insert into productos (sku, nombre, descripcion, categoria_id, temporada, costo_unitario, precio_venta, stock_actual, stock_minimo, activo)
select
    'NAV-MDF-01',
    'Adorno Navideño Colgante MDF',
    'Sublimable por ambas caras',
    (select id from categorias where nombre = 'Papelería y Regalos'),
    'Navidad',
    450,
    1990,
    0,
    10,
    true
where not exists (select 1 from productos where sku = 'NAV-MDF-01');
