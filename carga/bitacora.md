# Bitácora de ejecuciones de carga

Una fila por ejecución (guía, tabla 6.2). La ventana de tiempo y el commit los
imprime `carga/ejecutar.sh` y quedan en `resultados/<ESCENARIO>/*.meta.json`.

**Servidor:** VM Azure Chile Central · 2 vCPU · 7,7 GB RAM · Ubuntu 24.04 · `PG_POOL_MAX=10`
**Generador:** PC `cachyos-KDEPlasma` · 6 CPU · 23 GiB RAM · [COMPLETAR: conexión cable / wifi] · k6 v2.4.0 · Docker local detenido durante las pruebas

| Run | Escenario | Rep. | Inicio – fin (Chile) | Commit | Umbrales | Observaciones |
|---|---|---|---|---|---|---|
| R01 | humo | – | 15-11-26 00:03:09 – 00:03:47 | `85d8b12` | cumplidos | Verificación. Sin `CONTRASENA_CLIENTES` (compradores como invitado), sin navegador real ni Prometheus |
| R02 | piloto | – | 15-11-26 00:26:26 – 00:30:33 | `f4ab914` | cumplidos | Calibración. p95 17 ms, 0 % errores. Capacidad estimada (ley de utilización) ≈ 22 sesiones/s → escalones del estrés ajustados a 5,10,15,20,30,40 sesiones/s con mesetas de 2 min |
| R03 | baja | R1 | 15-11-26 00:37:14 – 00:45:33 | `f4ab914` | cumplidos | p95 18,0 ms, 0 % errores. Little: 0,458 ses/s × 11,10 s = 5,08 ≈ 5 VUs. CPU VM 5,9 %; el monitoreo (≈4,4 % de un núcleo, cAdvisor 2,8 %) consume más que la API (1,7 %) |
| R04 | baja | R2 | 15-11-26 00:51:06 – 00:59:10 | `f4ab914` | cumplidos | p95 20,0 ms, 0 % errores. Coincide con R1 |
| R05 | baja | R3 | 15-11-26 01:03:44 – 01:11:57 | `f4ab914` | cumplidos | p95 17,5 ms, 0 % errores. Navegador real con TTFB p75 22 ms y FCP 145 ms (R1/R2 ≈ 10 y 105 ms) sin cambios en el servidor: variación de la red doméstica |
| R06 | normal | R1 | | | | |
| R07 | normal | R2 | | | | |
| R08 | normal | R3 | | | | |
| R09 | estres | R1 | | | | |
| R10 | estres | R2 | | | | |
| R11 | estres | R3 | | | | |

## Resumen por escenario

Tablas agregadas (promedio [mínimo–máximo] entre repeticiones), generadas con
`node carga/tabla-repeticiones.mjs carga/resultados/<ESCENARIO>`:

- `baja`: [`resultados/BAJA/RESUMEN.md`](resultados/BAJA/RESUMEN.md) — p95 global 18,5 ms [17,5–20,0], 0 % errores en las 3 repeticiones.
- `normal`: pendiente.
- `estres`: pendiente.

## Tabla de saturación (estrés, guía tabla 6.3)

| Ofrecido (sesiones/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | Error (%) | CPU api / db (%) | Pool en espera | Observación |
|---:|---:|---:|---:|---:|---:|---:|---|
| 5 | | | | | | | |
| 10 | | | | | | | |
| 15 | | | | | | | |
| 20 | | | | | | | |
| 30 | | | | | | | |
| 40 | | | | | | | |

## Experiencia de usuario (guía tabla 6.4)

| Indicador | Sin carga (`real`) | Carga normal | Estrés |
|---|---:|---:|---:|
| TTFB p75 (ms) | | | |
| LCP p75 (s) | | | |
| INP p75 (ms) | | | |
| CLS p75 | | | |
| Tasa de rebote GA4 (%) | | | |
| Conversión vitrina → compra (%) | | | |
