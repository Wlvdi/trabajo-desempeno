-- ==============================================================================
-- 03_vistas_dashboard_y_alertas.sql
-- Proyecto: Subligol
-- Descripción: Vistas optimizadas en PostgreSQL para:
--              - Panel de Control Comercial (Dashboard).
--              - Detección inmediata de stock crítico.
--              - Consulta accesible del historial de auditoría para usuarios.
-- ==============================================================================

-- 1. VISTA: Capital Inmovilizado y Resumen de Inventario
-- Permite saber al instante cuánto dinero hay en bodega y cuánto se proyecta recaudar
create or replace view vista_capital_inmovilizado as
select
    count(id) as total_productos_activos,
    coalesce(sum(stock_actual), 0) as unidades_totales,
    coalesce(sum(stock_actual * costo_unitario), 0) as capital_inmovilizado_costo,
    coalesce(sum(stock_actual * precio_venta), 0) as valor_total_venta_estimado,
    coalesce(sum(stock_actual * (precio_venta - costo_unitario)), 0) as margen_bruto_potencial
from productos
where activo = true;


-- 2. VISTA: Productos con Stock Crítico (Alertas para redes sociales / reposición)
-- Notifica qué productos están por agotarse para pausar publicaciones o generar compras
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


-- 3. VISTA: Balance Comercial General (Compras vs. Ventas)
create or replace view vista_balance_comercial as
select
    coalesce((select sum(total) from compras), 0) as total_invertido_compras,
    coalesce((select sum(total) from ventas), 0) as total_recaudado_ventas,
    (coalesce((select sum(total) from ventas), 0) - coalesce((select sum(total) from compras), 0)) as balance_neto,
    (select count(*) from ventas) as cantidad_ventas_realizadas,
    (select count(*) from compras) as cantidad_compras_realizadas;


-- 4. VISTA: Desglose de Ventas por Canal Digital (Instagram, WhatsApp, etc.)
create or replace view vista_ventas_por_canal as
select
    canal_venta,
    count(id) as cantidad_pedidos,
    coalesce(sum(total), 0) as total_ingresos
from ventas
group by canal_venta
order by total_ingresos desc;


-- 5. VISTA: Historial de Auditoría Accesible para Usuarios de la Aplicación
-- Muestra el log ordenado cronológicamente con nombre/email del responsable
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
