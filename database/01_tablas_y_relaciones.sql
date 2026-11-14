-- ==============================================================================
-- 01_tablas_y_relaciones.sql
-- Proyecto: Subligol - Sistema Web de Gestión de Stock, Compras y Ventas
-- Descripción: Definición de tablas maestras, soporte de temporadas,
--              movimientos de inventario y tabla de auditoría inmutable.
-- ==============================================================================

-- 1. Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- 2. TABLA: Categorías
-- Permite organizar los productos (ej: Tazas, Poleras, Botellas, Insumos)
create table if not exists categorias (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique,
    descripcion text,
    created_at timestamptz not null default now()
);

-- 3. TABLA: Productos
-- Diseñado con soporte de rotación de temporadas (Navidad, Escolar, etc.) y archivado lógico
create table if not exists productos (
    id uuid primary key default gen_random_uuid(),
    sku text unique,
    nombre text not null,
    descripcion text,
    categoria_id uuid references categorias(id) on delete set null,
    temporada text not null default 'General', -- Ej: 'Navidad', 'Escolar', 'Día de la Madre', 'General'
    costo_unitario numeric(12, 2) not null default 0 check (costo_unitario >= 0),
    precio_venta numeric(12, 2) not null default 0 check (precio_venta >= 0),
    stock_actual integer not null default 0,
    stock_minimo integer not null default 5 check (stock_minimo >= 0),
    activo boolean not null default true, -- false = archivado fuera de temporada sin perder historial
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Índices de consulta rápida
create index if not exists idx_productos_sku on productos(sku);
create index if not exists idx_productos_categoria on productos(categoria_id);
create index if not exists idx_productos_temporada on productos(temporada);
create index if not exists idx_productos_activo on productos(activo);

-- 4. TABLA: Compras (Cabecera)
-- Registro de adquisiciones e inversión en mercadería/insumos
create table if not exists compras (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    proveedor text,
    total numeric(12, 2) not null default 0 check (total >= 0),
    notas text,
    usuario_id uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

-- 5. TABLA: Detalle de Compras (Líneas de Entrada de Stock)
create table if not exists detalle_compras (
    id uuid primary key default gen_random_uuid(),
    compra_id uuid not null references compras(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete restrict,
    cantidad integer not null check (cantidad > 0),
    costo_unitario numeric(12, 2) not null check (costo_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

-- 6. TABLA: Ventas (Cabecera)
-- Registro de pedidos por canales digitales (Instagram, WhatsApp, etc.)
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

-- 7. TABLA: Detalle de Ventas (Líneas de Salida de Stock)
create table if not exists detalle_ventas (
    id uuid primary key default gen_random_uuid(),
    venta_id uuid not null references ventas(id) on delete cascade,
    producto_id uuid not null references productos(id) on delete restrict,
    cantidad integer not null check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    subtotal numeric(12, 2) not null check (subtotal >= 0),
    created_at timestamptz not null default now()
);

-- 8. TABLA: Historial de Auditoría Inmutable (Audit Logs)
-- Registro accesible para lectura por los usuarios, pero blindado contra modificación/borrado
create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    fecha timestamptz not null default now(),
    usuario_id uuid references auth.users(id) on delete set null,
    usuario_email text,
    tipo_evento text not null, -- 'COMPRA_ENTRADA', 'VENTA_SALIDA', 'CREACION_PRODUCTO', 'AJUSTE_STOCK', 'ARCHIVADO_PRODUCTO'
    entidad_afectada text not null, -- 'productos', 'ventas', 'compras'
    entidad_id uuid,
    descripcion text not null,
    detalle jsonb, -- Guarda snapshot o metadata asociada
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_fecha on audit_logs(fecha desc);
create index if not exists idx_audit_logs_tipo on audit_logs(tipo_evento);
create index if not exists idx_audit_logs_entidad on audit_logs(entidad_afectada, entidad_id);
