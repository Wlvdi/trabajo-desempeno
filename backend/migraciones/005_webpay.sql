-- =============================================================================
-- 005_webpay.sql
-- Pago con Webpay Plus en ambiente de INTEGRACIÓN de Transbank (sandbox,
-- tarjetas de prueba; nunca pasarela real).
--
-- Flujo: el checkout crea la venta en estado PENDIENTE (el stock queda
-- reservado: el trigger de detalle_ventas ya lo descontó), el comprador paga
-- en Webpay y al volver la API la deja PAGADO o ANULADO.
--   * pago_token: token de la transacción en Webpay (token_ws). Único: con él
--     se encuentra la venta cuando Webpay devuelve al comprador.
--   * carrito_id: carrito del que salió la venta. El carrito se vacía recién
--     cuando el pago se aprueba; si se rechaza, el comprador lo conserva.
--     Sin llave foránea: es solo una referencia para vaciarlo; si el carrito
--     ya no existe, vaciarlo no hace nada.
--   * Al pasar una venta a ANULADO se devuelve su stock y se audita
--     (trigger trg_anular_venta).
--   * Las vistas del dashboard cuentan solo ventas PAGADO (antes contaban
--     todas porque no existían ventas pendientes ni anuladas).
-- El pago simulado (medio_pago "mock", pruebas de carga) no cambia.
-- =============================================================================
alter table ventas
    add column pago_token text unique,
    add column carrito_id uuid;

-- Venta anulada: devuelve el stock de cada línea y registra auditoría.
create function fn_anular_venta()
returns trigger as $$
declare
    d record;
    v_nombre_prod text;
    v_stock_nuevo integer;
begin
    for d in select producto_id, cantidad from detalle_ventas where venta_id = new.id order by producto_id loop
        update productos
        set stock_actual = stock_actual + d.cantidad
        where id = d.producto_id
        returning nombre, stock_actual into v_nombre_prod, v_stock_nuevo;

        insert into audit_logs (usuario_id, tipo_evento, entidad_afectada, entidad_id, descripcion, detalle)
        values (
            coalesce(new.usuario_id, fn_usuario_sesion()),
            'VENTA_ANULADA_ENTRADA',
            'productos',
            d.producto_id,
            'Devolución de stock por venta anulada ' || coalesce(new.codigo, '') || ': +' || d.cantidad
                || ' unid. de "' || coalesce(v_nombre_prod, 'Producto') || '" (Stock resultante: ' || v_stock_nuevo || ')',
            jsonb_build_object(
                'venta_id', new.id,
                'cantidad_devuelta', d.cantidad,
                'stock_anterior', v_stock_nuevo - d.cantidad,
                'stock_nuevo', v_stock_nuevo
            )
        );
    end loop;
    return new;
end;
$$ language plpgsql;

create trigger trg_anular_venta
after update of estado on ventas
for each row
when (old.estado <> 'ANULADO' and new.estado = 'ANULADO')
execute function fn_anular_venta();

-- Dashboard: solo ventas pagadas (mismas columnas que en 001).
create or replace view vista_balance_comercial as
select
    coalesce((select sum(total) from compras), 0) as total_invertido_compras,
    coalesce((select sum(total) from ventas where estado = 'PAGADO'), 0) as total_recaudado_ventas,
    coalesce((select sum(total) from ventas where estado = 'PAGADO'), 0)
        - coalesce((select sum(total) from compras), 0) as balance_neto,
    (select count(*) from ventas where estado = 'PAGADO') as cantidad_ventas_realizadas,
    (select count(*) from compras) as cantidad_compras_realizadas;

create or replace view vista_ventas_por_canal as
select
    canal_venta,
    count(id) as cantidad_pedidos,
    coalesce(sum(total), 0) as total_ingresos
from ventas
where estado = 'PAGADO'
group by canal_venta
order by total_ingresos desc;
