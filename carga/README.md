# Pruebas de carga de Subligol: cómo ejecutarlas y cómo documentarlas

Guía de la **Fase 1.2** (generadores de carga) y base de la **Fase 2**
(análisis). Sigue los capítulos 5 y 6 de `guia_desempeno_sistemas.pdf`.

| Archivo | Para qué |
|---|---|
| `k6/escenarios.js` | Generador de carga: 4 perfiles de usuario, 5 escenarios, umbrales (SLO) |
| `k6/navegador-real.js` | 1–2 navegadores Chromium reales en paralelo (GA4 y Web Vitals bajo carga) |
| `k6/datos/usuarios.csv` | 200 cuentas de prueba (`test001…test200@ejemplo.cl`), una por usuario virtual |
| `ejecutar.sh` | Ejecuta un escenario con el protocolo de la guía (6.3.1) y guarda los resultados |
| `tabla-resumen.mjs` | Convierte los resultados en tablas Markdown para el informe |
| `exportar-servidor.sh` | Exporta de Prometheus (lo que muestra Grafana) las métricas del **servidor** de cada prueba a CSV: no hacen falta capturas y no dependen de la VM |
| `tabla-repeticiones.mjs` | Junta las repeticiones (R1, R2, R3) de un escenario: promedio [mín–máx] de cada percentil por página |
| `bitacora.md` | Bitácora de ejecuciones (tabla 6.2 de la guía) |
| `resultados/<ESCENARIO>/` | Resultados de cada ejecución, una carpeta por escenario (`HUMO`, `PILOTO`, `BAJA`, `NORMAL`, `ESTRES`); el nombre lleva fecha y hora |

---

## 1. Qué simula el generador

**Herramienta: k6** (guía 5.1). Razones: escenarios declarativos, umbrales
automáticos (SLO), ejecutor de **tasa de llegada** (modelo abierto) y reporte
HTML. Locust era la alternativa (Python), pero solo tiene modelo cerrado.

### Perfiles de usuario (guía, tabla 5.2)
Cada iteración de k6 es **una sesión** de un usuario sintético; el perfil se
sortea por peso. Entre páginas hay **pausas aleatorias** (think time), como un
usuario real.

| Perfil | Peso | Recorrido (endpoints) | Pausa |
|---|---:|---|---|
| Navegante | 50 % | `GET /api/home` → `GET /api/productos` (página, orden y categoría al azar) → 1–3 × `GET /api/productos/:id` | 2–5 s |
| Buscador | 25 % | home → `GET /api/buscar?q=` → búsqueda con filtro (categoría, precio, orden o stock) → detalle | 1–4 s |
| Abandono | 15 % | detalle → `POST /api/carrito/items` (carrito anónimo) → `GET /api/carrito` → se va | 2–6 s |
| Comprador | 10 % | `POST /api/auth/login` (o invitado) → detalle → agregar → `POST /api/checkout` (pago simulado) → `GET /api/ordenes/:id` | 2–5 s |

Cada petición lleva la etiqueta **`pagina`** (`home`, `listado`, `busqueda`,
`detalle`, `carrito`, `login`, `checkout`, `orden`): así se obtienen
percentiles **por página**. Las tres páginas de distinto peso (guía 4.1.1) son
**home** (liviana), **listado** (media) y **detalle** (pesada).

### Escenarios (guía, tabla 5.3)
| Escenario | Ejecutor | Carga | Duración* | Objetivo |
|---|---|---|---|---|
| `humo` | 1 VU constante | 1 usuario | 30 s | Verificar que todo responde |
| `piloto` | ramping-vus | 0 → 10 VUs | 4 min | Calibrar antes de las pruebas reales |
| `baja` | ramping-vus | 0→5 (1 min), 5 (5 min), →0 (1 min) | 8 min | Línea base |
| `normal` | ramping-vus | 0→30 (2 min), 30 (10 min), →0 (2 min) | 15 min | Comportamiento sostenido |
| `estres` | **ramping-arrival-rate** | Mesetas de 20 → 50 → 100 → 150 sesiones/s (30 s de subida + 2,5 min por meseta) | 15 min | **Punto de saturación** |

\* Incluye **1 minuto de calentamiento** previo (2 VUs, etiqueta
`fase=calentamiento`) que **se excluye** de los umbrales y del análisis
(guía 4.4 y 6.3.1).

**Modelo cerrado vs abierto (guía 5.4):** en `baja` y `normal` hay N usuarios
fijos (cada uno espera la respuesta antes de seguir). En `estres` se fija la
**tasa de llegada** de sesiones: si el servidor se pone lento, k6 no reduce la
carga (evita la *omisión coordinada*) y la saturación se ve.

### Umbrales = SLO del sistema
| Indicador | SLO |
|---|---|
| Tasa de error HTTP | < 1 % |
| Latencia global | p95 < 800 ms y p99 < 1500 ms |
| Detalle de producto | p95 < 1000 ms |
| Checkout completo | p95 < 2000 ms |
| Checks funcionales | > 99 % |

En `estres` **se espera que fallen**: el escalón donde empiezan a fallar es el
punto de saturación.

---

## 2. Preparación (una vez)

1. **PC generador distinto del servidor** (guía 5.2): k6 corre en un PC del
   grupo, conectado **por cable** si es posible; el servidor es la VM de Azure.
2. Instalar k6 (`sudo pacman -S k6`, `winget install k6` o `brew install k6`)
   y tener Google Chrome o Chromium (para `navegador-real.js`).
3. Clave SSH de la VM en `~/.ssh/vm-subligol_key.pem` (permisos 600).
4. Contraseña de las cuentas de prueba (está en el `.env` de la VM):
   ```bash
   export CONTRASENA_CLIENTES=$(ssh -i ~/.ssh/vm-subligol_key.pem azureuser@subligol-utem.chilecentral.cloudapp.azure.com \
     'grep ^SEED_CONTRASENA_CLIENTES= trabajo-desempeno/.env | cut -d= -f2')
   ```

---

## 3. Cómo ejecutar una prueba (protocolo, guía 6.3.1)

### Orden recomendado
1. `humo` (verificación) → 2. `piloto` (calibración) → 3. `baja` ×3 →
4. `normal` ×3 → 5. `estres` ×3. Cada escenario **3 repeticiones** (R1, R2, R3)
para estimar la variabilidad (guía 6.3.1, paso 7).

### Antes
- VM **encendida** (portal de Azure) y sitio respondiendo.
- Abrir Grafana de la VM en otra terminal (túnel):
  ```bash
  ssh -i ~/.ssh/vm-subligol_key.pem -L 3001:localhost:3001 azureuser@subligol-utem.chilecentral.cloudapp.azure.com
  ```
  y abrir http://localhost:3001 (usuario `admin`, contraseña `GRAFANA_CONTRASENA` del `.env` de la VM).
- Cerrar programas pesados en el PC generador.

### Ejecutar
```bash
# Verificación rápida
carga/ejecutar.sh humo

# Prueba real: datos frescos, navegador real en paralelo y métricas de k6 en Grafana
RESEMBRAR=1 NAVEGADOR=1 PROMETHEUS=1 REPETICION=R1 carga/ejecutar.sh normal
```

| Variable | Efecto |
|---|---|
| `RESEMBRAR=1` | `npm run seed` en la VM antes de empezar: **mismos datos en cada prueba** (stock, historial de 90 días) |
| `NAVEGADOR=1` | Navegador real en paralelo con `?escenario=…` → Web Vitals en GA4 y en Grafana |
| `PROMETHEUS=1` | Métricas de k6 a Prometheus de la VM → fila "Generador (k6)" en Grafana, en la misma línea de tiempo que la CPU |
| `REPETICION=R1` | Se anota en los metadatos y en la bitácora |
| `PROPORCION_INVITADO=0.3` | 30 % de los compradores sin cuenta (por defecto 0: todos inician sesión) |
| `ESTRES_ESCALONES=10,30,60,100` | Ajustar los escalones del estrés tras el piloto |
| `MAX_VUS=1500` | Más VUs si aparecen "iteraciones descartadas" en el estrés |
| `FACTOR_PAUSAS=0.25` | Multiplica las pausas (think time). En el estrés reduce los VUs (y las conexiones simultáneas) a una cuarta parte para la misma tasa de sesiones, sin cambiar las peticiones por sesión: N = X·(R+Z) |
| `BASE_URL=http://localhost:3000` | Probar contra Docker local en vez de la VM |

### Durante
- Mirar Grafana (dashboard **Subligol – Desempeño**, refresco 5 s).
- Si la **CPU del PC generador** pasa de ~80 % (`top`), el cuello de botella
  es el generador, no el sitio: la prueba no sirve (guía 5.2).

### Después
- Esperar a que la CPU y las conexiones de la VM vuelvan a la línea base
  (**enfriamiento**, 2–3 min en Grafana) antes de la siguiente prueba.
- Anotar la ejecución en `bitacora.md` (el script imprime la ventana de tiempo).
- Las métricas del servidor quedan en `…servidor.csv`, `…rutas.csv` y
  `…consultas.csv` (los exporta `ejecutar.sh` al terminar). Prometheus solo
  guarda 15 días: si una prueba quedó sin exportar, ejecutar
  `carga/exportar-servidor.sh carga/resultados` antes de apagar o borrar la VM.
- (Opcional) capturas de Grafana con el **rango exacto** de la prueba para el video.
- `git add carga/resultados carga/bitacora.md && git commit` (los CSV crudos
  `*.csv.gz` no se suben: guardarlos comprimidos fuera del repositorio).

---

## 4. Dónde ver los resultados

| Fuente | Qué muestra | Cómo abrirla |
|---|---|---|
| `…_HHMM.html` | Reporte de k6 con gráficos: VUs, peticiones/s, latencias y errores en el tiempo | Abrir el archivo en el navegador |
| `…_HHMM.resumen.json` | Percentiles por página, throughput, errores, umbrales | `node carga/tabla-resumen.mjs <archivo>` → tabla Markdown |
| `…_HHMM.meta.json` | Commit, inicio y fin (hora de Chile), configuración, datos del generador | Texto |
| `…_HHMM.generador.log` | CPU (`us`, `sy`, `id`) y memoria del PC generador cada 5 s | Texto (`vmstat`) |
| `…_HHMM.navegador.json` | Web Vitals (LCP, FCP, TTFB, CLS, INP) de los navegadores reales | `browser_web_vital_*` (p75) |
| `…_HHMM.csv.gz` | Cada petición con sus etiquetas (para análisis estadístico y gráficos propios) | No se versiona |
| `…_HHMM.servidor.csv` | **Servidor cada 15 s**: req/s, p50/p95/p99, errores 4xx/5xx, peticiones en curso, CPU de la VM y de `api`/`db`/`web`/monitoreo, memoria, disco, red, event loop, pool de PostgreSQL, argon2, transacciones, compras, logins y VUs de k6 | Lo genera `ejecutar.sh` al terminar (o `carga/exportar-servidor.sh <meta.json>`) |
| `…_HHMM.rutas.csv` | req/s y p95 **por ruta** del servidor cada 15 s | Idem |
| `…_HHMM.consultas.csv` | Las 15 **consultas SQL más costosas** de la prueba (tiempo total, llamadas, ms por llamada y texto) | Idem |
| **Grafana** (túnel) | Servidor: latencia por ruta, CPU/memoria de host y contenedores, event loop, pool de PostgreSQL, consultas costosas, Web Vitals por escenario y la fila **Generador (k6)** | Rango de tiempo = ventana del `meta.json` |
| **GA4** | Embudo, eventos y Web Vitals segmentados por `escenario_prueba` | Informes → Tiempo real / Explorar (filtrar por `escenario_prueba`) |

---

## 5. Cómo documentarlo en el informe

El enunciado pide: **diseñar y construir generadores de carga** que simulen
usuarios concurrentes; **definir e interpretar indicadores** (latencia,
throughput, tasa de error, utilización de recursos y otros signos vitales); y
**analizar el comportamiento**. Sección por sección:

### 5.1 Diseño del generador de carga (Fase 1.2)
1. **Herramienta y justificación**: tabla comparativa k6 / Locust / JMeter
   (guía, tabla 5.1) y por qué k6 (sección 1 de esta guía).
2. **Perfiles de usuario**: la tabla de perfiles (pesos, recorrido, pausas) y
   por qué esos pesos (en un e-commerce la mayoría mira y pocos compran).
3. **Escenarios y parámetros**: la tabla de escenarios; explicar modelo cerrado
   (VUs) vs abierto (tasa de llegada) y el calentamiento.
4. **Datos de prueba**: 500 productos, 200 cuentas (`usuarios.csv`, una por
   VU), seed determinista que se repite antes de cada prueba, pago simulado
   (nunca se carga el sandbox de un tercero; guía 5.3).
5. **SLO**: la tabla de umbrales.
6. **Entorno**: VM (Azure Chile Central, 2 vCPU, 7,7 GB, Ubuntu 24.04, Docker),
   PC generador (CPU, RAM, conexión; están en `meta.json`), versión de k6.
7. **Construcción**: extractos de `escenarios.js` (un perfil, el escenario de
   estrés y los umbrales) y del comando de ejecución.

### 5.2 Indicadores: definición e interpretación
| Indicador | Definición | Fuente | Cómo se interpreta |
|---|---|---|---|
| Latencia (promedio, mediana, p90, p95, p99) | Tiempo de respuesta de cada petición | k6 (`http_req_duration`, cliente) y Prometheus (`http_request_duration_seconds`, servidor) | Usar **percentiles**: la cola larga la sufre el usuario (guía 6.4.1). La diferencia cliente − servidor es red |
| Throughput | Peticiones (y sesiones) completadas por segundo | k6 `http_reqs`, `iterations`; Prometheus | Debe crecer con la carga; si se aplana, hay saturación |
| Tasa de error | % de respuestas fallidas (4xx/5xx no esperados) | k6 `http_req_failed`; Grafana "Tasa de error" | Sobre 1 % rompe el SLO |
| Utilización de CPU / memoria / I/O | Uso de recursos del servidor | node-exporter (host), cAdvisor (contenedores `api` y `db`) | CPU cercana a 100 % = recurso saturado |
| Event loop lag | Retraso del bucle de Node.js | prom-client (`nodejs_eventloop_lag_*`) | Si sube, la API no alcanza a atender |
| Pool de PostgreSQL en espera | Peticiones esperando una conexión libre | `api_pg_pool_conexiones{estado="en_espera"}` | > 0 sostenido: el pool (`PG_POOL_MAX`) es el cuello |
| Consultas costosas | Tiempo acumulado por consulta | pg_stat_statements | Indica qué optimizar (p. ej., la búsqueda sin índices) |
| Costo de argon2 | Duración del hash al iniciar sesión | `api_contrasenas_duracion_segundos` | CPU que consume cada login |
| Conversión | Compras / sesiones | k6 `compras_ok`; GA4 embudo | Debe mantenerse bajo carga |
| Web Vitals (LCP, INP, CLS, TTFB, FCP) | Experiencia del usuario en el navegador | `navegador.json`, Grafana "Experiencia de usuario", GA4 | TTFB y LCP empeoran con la carga; CLS no debería cambiar |

### 5.3 Resultados (Fase 2)
- **Tablas por escenario y por página**:
  `node carga/tabla-repeticiones.mjs carga/resultados/BAJA > carga/resultados/BAJA/RESUMEN.md`
  junta las 3 repeticiones y reporta la media de cada percentil y su rango
  (mínimo–máximo), como pide la guía (6.4.1). Para una sola ejecución:
  `node carga/tabla-resumen.mjs <archivo>.resumen.json`.
- **Gráficos** (guía 6.4.3), todos en la misma escala de tiempo:
  1. Latencia (mediana, p95, p99) en el tiempo con los VUs o la tasa → reporte
     HTML de k6 o Grafana (paneles de latencia + "Usuarios virtuales").
  2. Throughput real vs carga ofrecida → Grafana "Sesiones iniciadas" vs
     "Throughput por ruta" (estrés).
  3. Tasa de error en el tiempo → Grafana "Tasa de error" / "Errores vistos por k6".
  4. CPU, memoria e I/O del servidor → Grafana fila "Recursos".
  5. Histograma o CDF de latencias por escenario → desde el `csv.gz`.
  6. Boxplot de latencia por página (home vs listado vs detalle) → desde el `csv.gz`.
  7. Web Vitals y embudo GA4: sin carga vs carga normal vs estrés.

### 5.4 Análisis del comportamiento
- **Validación con la Ley de Little** (guía 6.4.2): en `normal`,
  `N_VU ≈ X · (R + Z)`, con X = sesiones/s (`iterations`), R = duración media
  de la sesión sin pausas y Z = pausa media. Si no se cumple
  aproximadamente, hay un error de medición. Del lado del servidor,
  `N ≈ X · R` con "Peticiones en curso" (Grafana), throughput y latencia media.
- **Punto de saturación** (guía 6.5): con el estrés, completar por meseta
  (tabla 6.3): tasa ofrecida, throughput logrado, p50, p95, errores y CPU.
  Criterio: primera meseta con p95 > 800 ms **o** errores > 1 % **o**
  throughput < 90 % de lo ofrecido. Identificar el **recurso** saturado con
  Grafana (CPU de `api` o `db`, pool en espera, event loop, consultas).
- **Cuellos de botella y mejora** (guía 6.7): síntoma → causa (evidencia) →
  propuesta → re-medición. Candidata ya prevista: **índice `pg_trgm` en la
  búsqueda** (hoy sin índices), comparar antes y después con la misma prueba.
- **Experiencia de usuario** (guía 6.6, tabla 6.4): p75 de TTFB, LCP, INP y CLS
  por escenario (Grafana "Experiencia de usuario" o `navegador.json`) y
  rebote/conversión en GA4 filtrando `escenario_prueba`.

### 5.5 Limitaciones (amenazas a la validez)
- Red doméstica del generador (latencia y ancho de banda variables).
- VM de capa de estudiante (2 vCPU), compartida en la nube.
- Pocos navegadores reales: la muestra de Web Vitals y GA4 es pequeña; GA4
  puede filtrar tráfico de navegadores automatizados.
- Con más de 200 compradores simultáneos algunas cuentas de prueba coinciden.
- **Límite de conexiones del generador doméstico**: desde una red doméstica, k6
  no pudo abrir más de ~400 conexiones simultáneas con la VM (error 1211,
  *dial timeout*, sin que las conexiones llegaran al servidor). Por eso el
  estrés se ejecuta con `FACTOR_PAUSAS=0.25`: misma tasa de sesiones y mismas
  peticiones por sesión, pero ~4 veces menos usuarios "leyendo" a la vez. La
  carga sobre el servidor (peticiones/s) es la misma; cambia la concurrencia
  del lado del cliente.
- `experimental-prometheus-rw` está marcado como obsoleto para k6 v3.

---

## 6. Señales de que algo anda mal en la prueba
| Señal | Significa | Qué hacer |
|---|---|---|
| `dropped_iterations` > 0 en el estrés | k6 no tuvo VUs para la tasa pedida | Subir `MAX_VUS` o bajar los escalones |
| CPU del generador > 80 % | El generador es el cuello | Otro PC o menos carga |
| Muchos `compras_sin_stock` | Se agotó el stock | `RESEMBRAR=1` antes de cada prueba |
| Errores en `login` | Contraseña incorrecta | Revisar `CONTRASENA_CLIENTES` |
| Primera petición muy lenta | VM recién encendida | El calentamiento lo absorbe; no medir sin él |
