-- =============================================================================
-- 002_tienda.sql
-- Extensiones del esquema para la tienda web:
--   * Datos de presentación del producto (antes solo en mockData.js).
--   * Galería de imágenes (agrega un join real al detalle de producto).
--   * Datos del pedido web en `ventas` (antes mezclados en `notas`).
--   * Carrito persistente en base de datos.
--   * Stock nunca negativo.
--   * pg_stat_statements para la Fase 2.
-- =============================================================================

-- Estadísticas de consultas (requiere shared_preload_libraries, ver docker-compose.yml).
create extension if not exists pg_stat_statements;

-- -----------------------------------------------------------------------------
-- Productos: presentación en la tienda
-- -----------------------------------------------------------------------------
alter table productos
    add column imagen_url text,
    add column destacado boolean not null default false,
    add column descripcion_larga text,
    add column especificaciones jsonb not null default '{}'::jsonb;

-- Antes el trigger de ventas podía dejar el stock negativo.
alter table productos
    add constraint ck_productos_stock_no_negativo check (stock_actual >= 0);

create table producto_imagenes (
    id uuid primary key default gen_random_uuid(),
    producto_id uuid not null references productos(id) on delete cascade,
    url text not null,
    orden smallint not null default 0,
    created_at timestamptz not null default now()
);

create index idx_producto_imagenes_producto on producto_imagenes (producto_id);

-- -----------------------------------------------------------------------------
-- Ventas: datos del pedido web
-- -----------------------------------------------------------------------------
alter table ventas
    add column codigo text unique,
    add column estado text not null default 'PAGADO'
        check (estado in ('PENDIENTE', 'PAGADO', 'ANULADO')),
    add column medio_pago text,
    add column codigo_autorizacion text,
    add column costo_envio numeric(12, 2) not null default 0 check (costo_envio >= 0),
    add column despacho jsonb,
    -- Cliente de la tienda que hizo el pedido (null en ventas manuales).
    add column cliente_id uuid references usuarios(id) on delete set null;

create index idx_ventas_cliente on ventas (cliente_id);

-- -----------------------------------------------------------------------------
-- Carrito persistente
-- Un carrito pertenece a un usuario registrado (usuario_id) o es anónimo
-- (usuario_id null); en ese caso su id funciona como token para el cliente.
-- -----------------------------------------------------------------------------
create table carritos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid unique references usuarios(id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_carritos_updated_at
before update on carritos
for each row execute function fn_actualizar_updated_at();

create table carrito_items (
    carrito_id uuid not null references carritos(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete cascade,
    cantidad integer not null check (cantidad > 0),
    created_at timestamptz not null default now(),
    primary key (carrito_id, producto_id)
);

create index idx_carrito_items_producto on carrito_items (producto_id);
