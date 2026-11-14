-- ==============================================================================
-- 05_datos_semilla_pruebas.sql
-- Proyecto: Subligol
-- Descripción: Datos iniciales de prueba (Categorías de sublimación y productos
--              con diferentes temporadas y niveles de stock).
-- ==============================================================================

-- 1. Insertar Categorías base
insert into categorias (nombre, descripcion)
values
    ('Tazas y Tazones', 'Tazas de cerámica, mágicas, polímero y vidrio esmerilado'),
    ('Poleras y Textiles', 'Poleras tacto algodón, polerones, tote bags y jockey'),
    ('Botellas y Shakers', 'Botellas de aluminio, térmicas y botellas deportivas'),
    ('Papelería y Regalos', 'Agendas personalizadas, llaveros, mousepads y puzzles'),
    ('Insumos y Blancos', 'Cajas para tazas, cintas térmicas y papel de sublimación')
on conflict (nombre) do nothing;

-- 2. Insertar Productos de ejemplo con temporadas variadas
-- Notarás que al insertarse, el trigger fn_log_nuevo_producto() registrará el evento en audit_logs automáticamente.
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
    4, -- Stock crítico para probar alertas (stock_minimo es 8)
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
    0, -- Agotado para probar alerta
    10,
    true
where not exists (select 1 from productos where sku = 'NAV-MDF-01');
