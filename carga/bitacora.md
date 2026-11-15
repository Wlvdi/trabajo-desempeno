# Bitácora de ejecuciones de carga

Una fila por ejecución (guía, tabla 6.2). La ventana de tiempo y el commit los
imprime `carga/ejecutar.sh` y quedan en `resultados/AAAA-MM-DD/*.meta.json`.

**Servidor:** VM Azure Chile Central · 2 vCPU · 7,7 GB RAM · Ubuntu 24.04 · `PG_POOL_MAX=10`
**Generador:** [COMPLETAR: equipo, CPU, RAM, conexión (cable / wifi)] · k6 v2.4.0

| Run | Escenario | Rep. | Inicio – fin (Chile) | Commit | Umbrales | Observaciones |
|---|---|---|---|---|---|---|
| R01 | humo | – | | | | |
| R02 | piloto | – | | | | |
| R03 | baja | R1 | | | | |
| R04 | baja | R2 | | | | |
| R05 | baja | R3 | | | | |
| R06 | normal | R1 | | | | |
| R07 | normal | R2 | | | | |
| R08 | normal | R3 | | | | |
| R09 | estres | R1 | | | | |
| R10 | estres | R2 | | | | |
| R11 | estres | R3 | | | | |

## Tabla de saturación (estrés, guía tabla 6.3)

| Ofrecido (sesiones/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | Error (%) | CPU api / db (%) | Pool en espera | Observación |
|---:|---:|---:|---:|---:|---:|---:|---|
| 20 | | | | | | | |
| 50 | | | | | | | |
| 100 | | | | | | | |
| 150 | | | | | | | |

## Experiencia de usuario (guía tabla 6.4)

| Indicador | Sin carga (`real`) | Carga normal | Estrés |
|---|---:|---:|---:|
| TTFB p75 (ms) | | | |
| LCP p75 (s) | | | |
| INP p75 (ms) | | | |
| CLS p75 | | | |
| Tasa de rebote GA4 (%) | | | |
| Conversión vitrina → compra (%) | | | |
