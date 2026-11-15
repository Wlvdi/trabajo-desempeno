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
| R06 | normal | R1 | 15-11-26 01:15:57 – 01:31:12 | `c4cbbd6` | cumplidos | p95 17,6 ms, 0 % errores, 193 compras. Little cliente: 2,663 ses/s × 11,32 s ≈ 30 VUs; servidor: X·R = 0,076 vs N = 0,067. CPU VM 10,7 %. Capacidad estimada (ley de utilización) ≈ 37 ses/s → escalones del estrés 10…60 |
| R07 | normal | R2 | 15-11-26 01:33:39 – 01:48:53 | `c4cbbd6` | cumplidos | p95 18,1 ms, 0 % errores. Igual a R1 (diferencias < 0,5 ms por página) |
| R08 | normal | R3 | 15-11-26 09:28:46 – 09:43:58 | `c4cbbd6` | cumplidos | p95 16,9 ms, 0 % errores. Ejecutada 7 h después (otra hora del día) y con los mismos resultados |
| R09 | estres | (inválida) | 15-11-26 09:55:46 – 10:06:28 | `c4cbbd6` | no cumplidos | **Inválida como estrés.** Escalones 10…60 ses/s, pausas normales. Desde ~400 VUs (≈24 ses/s, min 7) errores 1211 *dial timeout* (2 % → 17 %): k6 no pudo abrir conexiones; no llegaron a la VM (0 desbordes/descartes en el kernel de Caddy). Servidor sano: CPU VM ≤ 64 %, p95 45–64 ms a ~100 req/s, pool sin espera. Causa: límite de conexiones de la red doméstica del generador. Detenida a los 10:39. Se repite con `FACTOR_PAUSAS=0.25` |
| R09b | estres | R1 | 15-11-26 10:15:29 – 10:33:02 | `c4cbbd6` | no cumplidos (esperado) | `FACTOR_PAUSAS=0.25`, escalones 10…60. Rodilla en 40 ses/s (p95 914 ms, CPU 95 %). Máx. 174,6 req/s |
| R10 | estres | R2 | 15-11-26 11:00:52 – 11:18:31 | `c4cbbd6` | no cumplidos (esperado) | Lanzada con `REPETICION=R1` por error (corregido a R2 en el meta.json). En 40 ses/s p95 554 ms; satura en 50. Máx. 173,2 req/s |
| R11 | estres | R3 | 15-11-26 11:20:35 – 11:38:09 | `c4cbbd6` | no cumplidos (esperado) | En 40 ses/s p95 648 ms; satura en 50. Máx. 166,9 req/s |

## Resumen por escenario

Tablas agregadas (promedio [mínimo–máximo] entre repeticiones), generadas con
`node carga/tabla-repeticiones.mjs carga/resultados/<ESCENARIO>`:

- `baja`: [`resultados/BAJA/RESUMEN.md`](resultados/BAJA/RESUMEN.md) — p95 global 18,5 ms [17,5–20,0], 0 % errores en las 3 repeticiones.
- `normal`: [`resultados/NORMAL/RESUMEN.md`](resultados/NORMAL/RESUMEN.md) — p95 global 17,5 ms [16,9–18,1], 0 % errores; sin degradación respecto de `baja` con 6 veces más carga.
- `estres`: [`resultados/ESTRES/RESUMEN.md`](resultados/ESTRES/RESUMEN.md) — tabla de saturación agregada, conclusiones y consultas más costosas.

## Tabla de saturación (estrés, guía tabla 6.3)

Promedio [mín–máx] de R1, R2 y R3 (detalle y conclusiones en `resultados/ESTRES/RESUMEN.md`).

| Ofrecido (ses/s) | Logrado (ses/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error (%)* | CPU VM (%) | CPU api / db (% 1 núcleo) | Pool en espera (máx) |
|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 10 | 10.0 [10.0–10.0] | 39.7 [39.6–39.9] | 9 [9–9] | 23 [21–26] | 139 [137–141] | 0.0 [0.0–0.0] | 26 [26–27] | 23 / 17 | 0 [0–0] |
| 20 | 20.0 [19.9–20.0] | 78.8 [78.5–78.9] | 10 [10–10] | 36 [33–38] | 195 [170–213] | 0.0 [0.0–0.0] | 47 [45–49] | 44 / 35 | 0 [0–0] |
| 30 | 29.9 [29.8–30.0] | 118.6 [118.2–118.9] | 15 [14–16] | 117 [114–119] | 346 [311–412] | 0.0 [0.0–0.0] | 72 [70–73] | 68 / 55 | 4 [0–7] |
| 40 | 39.5 [39.1–40.2] | 155.5 [154.4–157.6] | 242 [205–295] | 705 [554–914] | 1110 [892–1332] | 0.0 [0.0–0.0] | 95 [95–96] | 92 / 79 | 155 [95–218] |
| 50 | 40.4 [39.6–41.6] | 164.4 [162.5–167.2] | 900 [821–998] | 1507 [1349–1676] | 2090 [1939–2256] | 5.8 [5.2–6.2] | 100 [100–100] | 94 / 86 | 306 [264–348] |
| 60 | 44.1 [43.0–45.0] | 171.6 [166.9–174.6] | 1077 [1002–1163] | 1803 [1651–1915] | 2480 [2247–2597] | 13.7 [12.9–14.4] | 100 [100–100] | 94 / 86 | 343 [321–373] |

\* Errores `1211` del generador (límite de conexiones de la red doméstica), no del servidor.

**Punto de saturación:** rodilla en ~40 sesiones/s (~155 req/s, CPU 95 %);
criterio 6.5 superado en 50 ses/s (R2, R3) o 40 (R1). **Recurso limitante:**
CPU de la VM (2 vCPU) compartida por la API y PostgreSQL.

## Experiencia de usuario (guía tabla 6.4)

| Indicador | Carga baja (5 VUs) | Carga normal (30 VUs) | Estrés |
|---|---:|---:|---:|
| TTFB p75 (ms) | 14 [10–22] | 20 [16–23] | 19 [14–23] |
| LCP p75 (s) | 0,172 [0,166–0,176] | 0,173 [0,172–0,173] | 0,200 [0,188–0,208] |
| INP p75 (ms) | 5 [4–8] (n ≈ 6) | 1 [0–4] (n ≈ 13) | 3 [0–8] (n ≈ 9) |
| CLS p75 | 0,005 | 0,005 | 0,004 |
| Tasa de rebote GA4 (%) | | | |
| Conversión vitrina → compra (%) | | | |

Web Vitals del navegador real (`*.navegador.json`), promedio [mín–máx] de las 3
repeticiones. En el estrés el p75 cambia poco porque las visitas se reparten en
todos los escalones, pero hubo una navegación cortada a los 30 s y un LCP máximo
de 137 s durante la saturación (R1). Rebote y conversión: completar desde GA4
filtrando `escenario_prueba` (baja / normal / estres).
