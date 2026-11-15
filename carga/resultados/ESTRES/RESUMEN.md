## Tabla de saturación agregada (guía, tabla 6.3)

Promedio [mínimo–máximo] de las 3 repeticiones por meseta (últimos 100 s de cada
una). Generada con `node carga/tabla-saturacion.mjs` sobre R1, R2 y R3.
Configuración: escalones 10…60 sesiones/s, mesetas de 2 min, `FACTOR_PAUSAS=0.25`.

| Ofrecido (ses/s) | Logrado (ses/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error (%)* | CPU VM (%) | CPU api / db (% 1 núcleo) | Pool en espera (máx) |
|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 10 | 10.0 [10.0–10.0] | 39.7 [39.6–39.9] | 9 [9–9] | 23 [21–26] | 139 [137–141] | 0.0 [0.0–0.0] | 26 [26–27] | 23 / 17 | 0 [0–0] |
| 20 | 20.0 [19.9–20.0] | 78.8 [78.5–78.9] | 10 [10–10] | 36 [33–38] | 195 [170–213] | 0.0 [0.0–0.0] | 47 [45–49] | 44 / 35 | 0 [0–0] |
| 30 | 29.9 [29.8–30.0] | 118.6 [118.2–118.9] | 15 [14–16] | 117 [114–119] | 346 [311–412] | 0.0 [0.0–0.0] | 72 [70–73] | 68 / 55 | 4 [0–7] |
| 40 | 39.5 [39.1–40.2] | 155.5 [154.4–157.6] | 242 [205–295] | 705 [554–914] | 1110 [892–1332] | 0.0 [0.0–0.0] | 95 [95–96] | 92 / 79 | 155 [95–218] |
| 50 | 40.4 [39.6–41.6] | 164.4 [162.5–167.2] | 900 [821–998] | 1507 [1349–1676] | 2090 [1939–2256] | 5.8 [5.2–6.2] | 100 [100–100] | 94 / 86 | 306 [264–348] |
| 60 | 44.1 [43.0–45.0] | 171.6 [166.9–174.6] | 1077 [1002–1163] | 1803 [1651–1915] | 2480 [2247–2597] | 13.7 [12.9–14.4] | 100 [100–100] | 94 / 86 | 343 [321–373] |

\* Todos los errores son `1211` (*dial timeout*) del generador: cuando el
servidor se satura, las sesiones se alargan, k6 sube a 850–1000 VUs y la red
doméstica no abre más conexiones. El servidor no devolvió errores 5xx.

**Conclusiones**
- **Rodilla en 40 sesiones/s (~155 req/s)**: CPU de la VM al 95–96 % y el p95
  salta de ~117 ms (30 ses/s) a 705 ms [554–914].
- **Punto de saturación (criterio 6.5)**: 50 sesiones/s en R2 y R3 (p95 > 800 ms
  y logrado < 90 % de lo ofrecido); en R1 ya en 40 (p95 914 ms).
- **Throughput máximo**: ~172 req/s (~44 sesiones/s) con la CPU al 100 %.
- **Recurso limitante**: CPU de la VM (2 vCPU) compartida por la API (Node +
  argon2, ~94 % de un núcleo) y PostgreSQL (~86 %). El pool en espera
  (155–343) es consecuencia: PostgreSQL responde más lento sin CPU libre.
- **Ley de utilización**: a 30 ses/s la VM usa 72 % de 2 núcleos → ~48 ms de
  CPU por sesión → X_max ≈ 2 / 0,048 ≈ 41 ses/s (medido: 40–45).
- **Consulta más costosa**: "productos relacionados" del detalle (suma todas
  las ventas en cada visita): ~79 % del tiempo de PostgreSQL, ~33 ms por
  llamada bajo estrés en las 3 repeticiones. Candidata a la mejora (6.7).

---

### Escenario `estres`: 3 repeticiones (R1, R2, R3)

Valores: **promedio [mínimo–máximo]** entre repeticiones, en ms, solo fase de medición.

| Ejecución | Repetición | Inicio – fin (Chile) | Commit | Umbrales |
|---|---|---|---|---|
| estres_2026-11-15_1015 | R1 | 2026-11-15 10:15:29 – 10:33:02 | `c4cbbd6` | NO cumplidos |
| estres_2026-11-15_1100 | R2 | 2026-11-15 11:00:52 – 11:18:31 | `c4cbbd6` | NO cumplidos |
| estres_2026-11-15_1120 | R3 | 2026-11-15 11:20:35 – 11:38:09 | `c4cbbd6` | NO cumplidos |

| Página | n (por repetición) | Promedio | Mediana | p90 | p95 | p99 | Máx |
|---|---|---:|---:|---:|---:|---:|---:|
| **Todas** | 115525 / 115362 / 114324 | 487.0 [446.5–539.2] | 266.2 [236.7–324.5] | 1227.6 [1134.8–1336.1] | 1393.4 [1270.8–1519.7] | 1948.5 [1784.7–2071.3] | 3659.2 [3027.3–4500.3] |
| home | 22129 / 22179 / 21923 | 434.5 [394.9–486.5] | 209.5 [183.4–258.1] | 1139.2 [1051.4–1247.0] | 1278.2 [1169.8–1389.1] | 1505.5 [1364.8–1638.4] | 2235.2 [1929.7–2627.7] |
| listado | 14764 / 14824 / 14578 | 436.1 [394.3–488.3] | 203.4 [169.7–258.6] | 1147.3 [1057.4–1253.9] | 1281.5 [1174.9–1394.1] | 1517.8 [1388.4–1637.3] | 2206.7 [1781.2–2725.6] |
| busqueda | 14606 / 14569 / 14539 | 444.2 [410.6–490.8] | 223.8 [197.9–263.3] | 1147.1 [1066.7–1249.3] | 1290.5 [1188.6–1396.0] | 1532.8 [1411.2–1642.4] | 2144.1 [1724.7–2645.4] |
| detalle | 43683 / 43744 / 43195 | 475.4 [436.8–526.8] | 263.7 [236.3–310.7] | 1203.1 [1113.6–1311.5] | 1341.2 [1229.5–1462.2] | 1563.7 [1435.6–1686.1] | 2333.0 [2041.5–2834.4] |
| carrito | 11813 / 11576 / 11634 | 630.2 [579.0–702.6] | 341.4 [296.4–415.1] | 1690.7 [1560.8–1878.3] | 2080.2 [1929.2–2274.8] | 2602.8 [2383.7–2809.1] | 3659.2 [3027.3–4500.3] |
| login | 2991 / 2948 / 2963 | 924.9 [879.8–956.7] | 852.2 [788.4–916.1] | 1926.0 [1817.6–1994.5] | 2130.6 [2015.9–2210.7] | 2553.0 [2454.5–2639.0] | 3030.4 [2897.5–3229.0] |
| checkout | 2781 / 2766 / 2755 | 538.1 [496.2–578.1] | 419.3 [359.2–479.3] | 1276.3 [1200.4–1359.5] | 1426.3 [1335.8–1527.3] | 1689.9 [1546.4–1797.6] | 2443.9 [2108.9–2953.1] |
| orden | 2758 / 2756 / 2737 | 457.9 [417.8–495.4] | 295.9 [235.5–352.7] | 1144.6 [1062.4–1230.5] | 1285.4 [1169.9–1391.4] | 1526.5 [1389.2–1609.0] | 2154.8 [1731.6–2573.6] |

| Indicador | Promedio [mín–máx] | Por repetición |
|---|---:|---|
| Throughput (peticiones/s, toda la prueba) | 109.75 [109.04–110.19] | 110.19 / 110.02 / 109.04 |
| Sesiones por segundo (toda la prueba) | 27.796 [27.610–27.944] | 27.944 / 27.832 / 27.610 |
| Duración media de sesión R+Z (s) | 10.27 [10.19–10.39] | 10.19 / 10.24 / 10.39 |
| Tasa de error HTTP, medición (%) | 5.45 [5.21–5.63] | 5.21 / 5.51 / 5.63 |
| Checks exitosos, medición (%) | 94.53 [94.35–94.77] | 94.77 / 94.48 / 94.35 |
| Checkout completo p95 (ms) | 1426.3 [1335.8–1528.0] | 1528.0 / 1335.8 / 1415.3 |
| Compras exitosas | 2756 [2743–2763] | 2763 / 2763 / 2743 |
| Compras sin stock | 0 [0–0] | 0 / 0 / 0 |
| VUs máximos | 1002 [1002–1002] | 1002 / 1002 / 1002 |
| Iteraciones descartadas | 2954 [2812–3131] | 2812 / 2919 / 3131 |

| Web Vital (p75, navegador real) | Promedio [mín–máx] | Por repetición | Muestras |
|---|---:|---|---|
| TTFB (ms) | 19 [14–23] | 23 / 22 / 14 | 185 / 185 / 161 |
| FCP (ms) | 153 [152–156] | 152 / 156 / 152 | 185 / 185 / 161 |
| LCP (ms) | 200 [188–208] | 188 / 208 / 204 | 185 / 185 / 161 |
| INP (ms) | 3 [0–8] | 2 / 8 / 0 | 8 / 12 / 7 |
| CLS | 0.004 [0.004–0.004] | 0.004 / 0.004 / 0.004 | 185 / 185 / 161 |


### Saturación: estres_2026-11-15_1015 (R1)

Escalones 10, 20, 30, 40, 50, 60 sesiones/s · mesetas de 120 s (se usan los últimos 100 s) · factor de pausas 0.25 · máx. 1000 VUs

| Ofrecido (ses/s) | Logrado (ses/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error (%) | Errores (código: n) | VUs | Descartadas | CPU VM (%) | CPU api / db (% 1 núcleo) | Pool en espera | Event loop p99 (ms) | argon2 p95 (ms) |
|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---:|---:|---:|
| 10 | 10.0 | 39.6 | 9 | 22 | 137 | 0.0 | – | 36 | 0 | 26 | 22 / 17 | 0 | 12.5 | 195 |
| 20 | 20.0 | 78.9 | 10 | 38 | 213 | 0.0 | – | 66 | 0 | 48 | 45 / 35 | 0 | 15.4 | 374 |
| 30 | 29.8 | 118.9 | 16 | 119 | 412 | 0.0 | – | 99 | 2 | 72 | 69 / 56 | 7 | 23.8 | 830 |
| 40 | 39.1 | 154.4 | 295 | 914 | 1332 | 0.0 | – | 232 | 88 | 95 | 92 / 79 | 218 | 51.4 | 1545 |
| 50 | 41.6 | 167.2 | 998 | 1676 | 2256 | 5.2 | 1211: 873 | 842 | 430 | 100 | 94 / 87 | 348 | 48.6 | 1502 |
| 60 | 45.0 | 174.6 | 1163 | 1843 | 2597 | 12.9 | 1211: 2254 | 1000 | 1495 | 100 | 93 / 88 | 373 | 47.9 | 1553 |

Criterio de saturación (guía 6.5): primera meseta con p95 > 800 ms, o error > 1 %, o logrado < 90 % de lo ofrecido.

### Saturación: estres_2026-11-15_1100 (R2)

Escalones 10, 20, 30, 40, 50, 60 sesiones/s · mesetas de 120 s (se usan los últimos 100 s) · factor de pausas 0.25 · máx. 1000 VUs

| Ofrecido (ses/s) | Logrado (ses/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error (%) | Errores (código: n) | VUs | Descartadas | CPU VM (%) | CPU api / db (% 1 núcleo) | Pool en espera | Event loop p99 (ms) | argon2 p95 (ms) |
|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---:|---:|---:|
| 10 | 10.0 | 39.9 | 9 | 26 | 141 | 0.0 | – | 35 | 0 | 27 | 25 / 17 | 0 | 13.2 | 197 |
| 20 | 20.0 | 78.9 | 10 | 37 | 202 | 0.0 | – | 64 | 0 | 49 | 47 / 35 | 0 | 15.6 | 441 |
| 30 | 30.0 | 118.7 | 14 | 114 | 311 | 0.0 | – | 102 | 2 | 73 | 71 / 56 | 0 | 25.8 | 782 |
| 40 | 40.2 | 157.6 | 205 | 554 | 892 | 0.0 | 1211: 7 | 201 | 6 | 95 | 89 / 79 | 95 | 39.6 | 1715 |
| 50 | 39.6 | 162.5 | 821 | 1349 | 1939 | 5.9 | 1211: 952 | 863 | 519 | 100 | 92 / 86 | 264 | 46.5 | 1453 |
| 60 | 44.3 | 173.2 | 1002 | 1651 | 2247 | 13.8 | 1211: 2386 | 1000 | 1566 | 100 | 95 / 87 | 321 | 53.8 | 1389 |

Criterio de saturación (guía 6.5): primera meseta con p95 > 800 ms, o error > 1 %, o logrado < 90 % de lo ofrecido.

### Saturación: estres_2026-11-15_1120 (R3)

Escalones 10, 20, 30, 40, 50, 60 sesiones/s · mesetas de 120 s (se usan los últimos 100 s) · factor de pausas 0.25 · máx. 1000 VUs

| Ofrecido (ses/s) | Logrado (ses/s) | Logrado (req/s) | p50 (ms) | p95 (ms) | p99 (ms) | Error (%) | Errores (código: n) | VUs | Descartadas | CPU VM (%) | CPU api / db (% 1 núcleo) | Pool en espera | Event loop p99 (ms) | argon2 p95 (ms) |
|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---|---:|---:|---:|
| 10 | 10.0 | 39.6 | 9 | 21 | 138 | 0.0 | – | 36 | 0 | 26 | 23 / 17 | 0 | 12.7 | 199 |
| 20 | 19.9 | 78.5 | 10 | 33 | 170 | 0.0 | – | 67 | 0 | 45 | 40 / 34 | 0 | 15.5 | 332 |
| 30 | 29.9 | 118.2 | 15 | 118 | 314 | 0.0 | – | 103 | 1 | 70 | 65 / 54 | 5 | 27.2 | 875 |
| 40 | 39.3 | 154.4 | 225 | 648 | 1105 | 0.0 | 1211: 7 | 206 | 57 | 96 | 95 / 78 | 151 | 47.1 | 1566 |
| 50 | 40.0 | 163.4 | 880 | 1496 | 2076 | 6.2 | 1211: 1014 | 872 | 500 | 100 | 96 / 84 | 306 | 50.0 | 1702 |
| 60 | 43.0 | 166.9 | 1065 | 1915 | 2595 | 14.4 | 1211: 2401 | 1000 | 1702 | 100 | 93 / 82 | 335 | 47.2 | 1456 |

Criterio de saturación (guía 6.5): primera meseta con p95 > 800 ms, o error > 1 %, o logrado < 90 % de lo ofrecido.
