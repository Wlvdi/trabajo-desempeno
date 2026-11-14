-- =============================================================================
-- 003_checkout.sql
-- Secuencia para el código de las órdenes web: SUB-AAAA-NNNNNN.
--   * Empieza en 500000 para no chocar con los códigos del seed (100000-102999).
--   * maxvalue 999999 garantiza siempre 6 dígitos (al agotarse, el checkout
--     falla en vez de generar un código con otro formato).
--   * nextval no se revierte con ROLLBACK: un checkout fallido deja un hueco
--     en la numeración. Es esperado y no afecta la unicidad.
-- Sin índices nuevos: (cliente_id, fecha) para "mis órdenes" queda como
-- mejora medible en la Fase 2.
-- =============================================================================
create sequence seq_codigo_venta as integer
    start 500000 minvalue 500000 maxvalue 999999 no cycle;
