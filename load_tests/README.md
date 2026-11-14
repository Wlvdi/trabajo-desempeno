# Guía de Pruebas de Carga y Analítica GA4 - Subligol (UTEM)
**Asignatura: Desempeño de Sistemas • Tarea 1**

Esta carpeta contiene los scripts automatizados de clientes sintéticos (K6 y Locust) para ejecutar las **Fase 1.2** y recolectar los indicadores de infraestructura y experiencia de usuario de la **Fase 2**.

---

## 1. Configuración de Google Analytics 4 (GA4)

### A. Invitar al Profesor a la Propiedad de GA4
Para cumplir con el requisito obligatorio de permitir la visualización de datos:
1. Ingresa a [Google Analytics](https://analytics.google.com/).
2. Haz clic en **Administrar** (icono de engranaje en la esquina inferior izquierda).
3. En la columna de tu propiedad (o cuenta), selecciona **Administración de accesos a la propiedad** (Property Access Management).
4. Haz clic en el botón azul `+` -> **Añadir usuarios**.
5. Ingresa el correo: `j.aranda@utem.cl`
6. Asigna el rol **Lector** (o Visualizador).
7. Haz clic en **Añadir**.

### B. Configurar tu ID de Medición en el Proyecto
Copia tu ID de Medición (`G-XXXXXXXXXX`) y colócalo en el archivo `.env.local` en la raíz de `subligol`:
```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

El código de Subligol ya tiene integrados los siguientes eventos oficiales de GA4:
- `page_view`: Rastreo automático de cada cambio de página en la SPA.
- `view_item`: Al visualizar la ficha técnica de un producto en `/producto/:id`.
- `add_to_cart`: Al añadir productos al carrito.
- `remove_from_cart`: Al eliminar ítems del carrito.
- `begin_checkout`: Al ingresar a la pantalla de despacho en `/checkout`.
- `purchase`: Al completar la transacción en el Sandbox de Webpay Plus.
- **Core Web Vitals**: Reporta automáticamente LCP, INP, CLS, FCP y TTFB a GA4 mediante la librería oficial `web-vitals`.

---

## 2. Generadores de Carga (Fase 1.2)

### Opción A: Ejecución con K6 (Recomendado)
Instala K6 si no lo tienes instalado (`winget install k6` o descárgalo desde [k6.io](https://k6.io)).

#### Escenario 1: Carga Baja (Baseline / Smoke Test)
```bash
# 5 usuarios concurrentes por 1 minuto
k6 run -e SCENARIO=baja -e TARGET_URL=http://localhost:5173 load_tests/k6_test.js
```

#### Escenario 2: Carga Sostenida Normal
```bash
# Ramp up hasta 40 usuarios concurrentes sostenidos por 2 minutos
k6 run -e SCENARIO=normal -e TARGET_URL=http://localhost:5173 load_tests/k6_test.js
```

#### Escenario 3: Carga Pico / Estrés (Stress Test)
```bash
# Ramp up progresivo hasta 200 usuarios concurrentes para hallar punto de saturación
k6 run -e SCENARIO=estres -e TARGET_URL=http://localhost:5173 load_tests/k6_test.js
```

#### Exportar Reporte para el Informe
```bash
k6 run --summary-export=reporte_k6.json load_tests/k6_test.js
```

---

### Opción B: Ejecución con Locust (Python)
Instala Locust:
```bash
pip install locust
```

#### Ejecutar con Interfaz Web Interactiva
```bash
locust -f load_tests/locustfile.py --host=http://localhost:5173
```
Abre en tu navegador `http://localhost:8089` y define los usuarios concurrentes (ej: 40) y ramp-up (ej: 5 users/s).

#### Ejecutar en Modo Headless y Exportar CSV
```bash
locust -f load_tests/locustfile.py --headless -u 50 -r 5 --run-time 2m --host=http://localhost:5173 --csv=resultados_locust
```

---

## 3. Matriz para el Informe de la Fase 2

Al ejecutar las pruebas en K6 o Locust, obtendrás directamente los datos requeridos por la pauta:

| Indicador | Carga Baja | Carga Sostenida | Carga Pico / Estrés |
|---|---|---|---|
| **Throughput (req/s)** | `http_reqs` rate | `http_reqs` rate | `http_reqs` rate |
| **Tiempo de respuesta Promedio** | `http_req_duration avg` | `http_req_duration avg` | `http_req_duration avg` |
| **Mediana** | `http_req_duration med` | `http_req_duration med` | `http_req_duration med` |
| **Percentil 90 (p90)** | `http_req_duration p(90)` | `http_req_duration p(90)` | `http_req_duration p(90)` |
| **Percentil 95 (p95)** | `http_req_duration p(95)` | `http_req_duration p(95)` | `http_req_duration p(95)` |
| **Percentil 99 (p99)** | `http_req_duration p(99)` | `http_req_duration p(99)` | `http_req_duration p(99)` |
| **Tasa de Error 4xx/5xx (%)** | `http_req_failed` | `http_req_failed` | `http_req_failed` |
| **Punto de saturación** | N/A (estable) | N/A (estable) | VU donde latencia o errores se disparan |
