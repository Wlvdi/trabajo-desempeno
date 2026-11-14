-- =============================================================================
-- 004_checkout_invitado.sql
-- Compra sin cuenta (checkout como invitado):
--   * cliente_email: correo de contacto de la orden. En compras con sesión es
--     el de la cuenta; en compras como invitado lo ingresa el comprador.
--   * token_consulta: secreto aleatorio que permite al invitado volver a ver
--     su orden (cabecera X-Orden-Token en GET /api/ordenes/:id). Se genera
--     para todas las órdenes, pero la API solo lo entrega al invitado.
-- Sin índices nuevos: la orden se busca por id y luego se compara el token.
-- =============================================================================
alter table ventas
    add column cliente_email text,
    add column token_consulta uuid not null default gen_random_uuid();
