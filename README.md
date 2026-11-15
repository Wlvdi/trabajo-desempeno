# Subligol

Proyecto del curso **INFB8091 Desempeño de Sistemas** (UTEM, 2026-2).
Tienda online de insumos de sublimación y estampados, construida para
instrumentarla con Google Analytics 4, generar carga sintética con k6 y
analizar su desempeño (guía: `guia_desempeno_sistemas.pdf`).

## Integrantes
- Wladimir Gallardo
- Rodrigo Donoso
- Leonardo Solís

## Enlaces
- Repositorio: https://github.com/Wlvdi/trabajo-desempeno
- Sitio desplegado: _pendiente (deploy)_

---

## Arquitectura

```
                 ┌──────────────── Navegador ────────────────┐
                 │  React + Vite (src/)                      │
                 │  gtag.js (GA4) · web-vitals               │
                 └──────┬───────────────────────┬────────────┘
                        │ /api (proxy de Vite)  │ eventos
                        ▼                       ▼
   k6 ──────────►  API Express 5 (backend/)   Google Analytics 4
   (carga)         :3000 pública              (DebugView, embudo)
                   :9464 /metrics (interno)
                        │ pool pg (PG_POOL_MAX)
                        ▼
                   PostgreSQL 16  ◄── postgres-exporter
                   (pg_stat_statements)
                        ▲
   Prometheus :9090 ────┴── node-exporter (host) · cAdvisor (contenedores)
        ▼
   Grafana :3001  (dashboard "Subligol – Desempeño")
```

| Componente | Tecnología | Carpeta |
|---|---|---|
| Frontend | React 18 + Vite 6, JavaScript, Tailwind CSS, react-router | `src/` |
| API | Node.js + Express 5 (ESM, JSDoc), en Docker | `backend/` |
| Base de datos | PostgreSQL 16 con migraciones SQL y seed determinista | `backend/migraciones/`, `backend/seeds/` |
| Observabilidad | prom-client, Prometheus, Grafana, node-exporter, cAdvisor, postgres-exporter | `infra/`, `docker-compose.yml` |
| Analítica | GA4 (gtag.js) y web-vitals | `src/services/analytics.js` |
| Carga | k6 | `carga/` |

### Servicios y puertos

| Servicio | URL en el equipo | Notas |
|---|---|---|
| Tienda (Vite, desarrollo) | http://localhost:5173 | `/api` se reenvía a la API |
| API | http://localhost:3000/api | |
| Métricas de la API | (interno) `api:9464/metrics` | No se publica: solo lo lee Prometheus |
| PostgreSQL | 127.0.0.1:5432 | Solo desde el propio equipo |
| Prometheus | http://127.0.0.1:9090 | Solo desde el propio equipo |
| Grafana | http://127.0.0.1:3001 | Usuario `admin`, contraseña `GRAFANA_CONTRASENA` |

En una VM, Prometheus y Grafana se ven con un túnel SSH:
`ssh -L 3001:localhost:3001 -L 9090:localhost:9090 usuario@vm`.

---

## Cómo levantar el proyecto

**Requisitos:** Node.js 22 o superior, Docker y Docker Compose. (k6 para las pruebas de carga.)

1. Copiar `.env.example` a `.env` y completar al menos `POSTGRES_PASSWORD`,
   `JWT_SECRETO` (`openssl rand -hex 32`), `SEED_CONTRASENA_CLIENTES`,
   `SEED_CONTRASENA_ADMIN`, `GRAFANA_CONTRASENA`, `PAGO_MOCK=true` y, si se
   usa GA4, `VITE_GA_MEASUREMENT_ID`.
2. API, base de datos y monitoreo: `docker compose up -d --build`
3. Migraciones y datos de prueba:
   `cd backend && npm ci && npm run migrate && npm run seed && cd ..`
4. Frontend: `npm install && npm run dev` → http://localhost:5173
5. Build de producción del frontend: `npm run build`

> Vite lee el `.env` solo al arrancar: después de cambiar una variable
> `VITE_*`, reiniciar `npm run dev`.

### Usuarios de prueba (creados por `npm run seed`)
| Usuario | Contraseña | Rol |
|---|---|---|
| `test001@ejemplo.cl` … `test200@ejemplo.cl` | `SEED_CONTRASENA_CLIENTES` | cliente |
| `admin@subligol.cl` | `SEED_CONTRASENA_ADMIN` | admin |

**Panel de administración:** http://localhost:5173/admin → "Iniciar sesión"
con `admin@subligol.cl`. Incluye dashboard, inventario, compras, ventas
manuales, pedidos web con sus datos de despacho, y auditoría.

`npm run seed` **borra y vuelve a crear** todos los datos: 500 productos,
201 usuarios y 3000 ventas históricas que terminan el día en que se ejecuta.
Antes de cada prueba de carga conviene volver a ejecutarlo.

### Variables de entorno (`.env`)
| Variable | Para qué sirve |
|---|---|
| `VITE_API_URL` | URL base de la API para el frontend (vacío = `/api` en el mismo origen) |
| `VITE_GA_MEASUREMENT_ID` | ID de GA4 (`G-…`). Vacío = GA4 deshabilitado |
| `VITE_GA_DEBUG` | `true` activa DebugView también en el build de producción |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales de PostgreSQL en Docker |
| `POSTGRES_PUERTO_HOST`, `API_PUERTO_HOST` | Puertos publicados en el equipo |
| `DATABASE_URL` | Conexión para `cd backend && npm run dev`, migraciones, seed y tests |
| `PG_POOL_MAX` | Tamaño del pool de conexiones (palanca de la Fase 2) |
| `SEED_CONTRASENA_CLIENTES`, `SEED_CONTRASENA_ADMIN` | Contraseñas de los usuarios de prueba |
| `JWT_SECRETO`, `JWT_EXPIRACION` | Firma y duración de la sesión (JWT HS256) |
| `ARGON2_MEMORIA_KIB`, `ARGON2_ITERACIONES`, `ARGON2_PARALELISMO` | Costo del hash de contraseñas (vacío = valores por defecto) |
| `PAGO_MOCK` | Habilita el pago simulado del checkout |
| `GRAFANA_CONTRASENA` | Contraseña del usuario `admin` de Grafana |
| `PROMETHEUS_PUERTO_HOST`, `GRAFANA_PUERTO_HOST`, `METRICAS_PUERTO` | Puertos del monitoreo |

---

## API

| Método y ruta | Descripción |
|---|---|
| `GET /api/salud` | Estado de la API y de la base de datos |
| `GET /api/home` | Destacados y categorías (página **liviana**) |
| `GET /api/categorias` | Categorías con su cantidad de productos |
| `GET /api/productos` | Catálogo con filtros, orden y paginación (página **media**) |
| `GET /api/productos/:id` | Detalle con galería, ventas de 90 días y relacionados (página **pesada**) |
| `GET /api/buscar?q=` | Búsqueda por texto (ILIKE, **sin índices**) con los mismos filtros |
| `POST /api/auth/registro`, `POST /api/auth/login`, `GET /api/auth/yo` | Cuentas (argon2id + JWT) |
| `GET/DELETE /api/carrito`, `POST /api/carrito/items`, `PATCH/DELETE /api/carrito/items/:id`, `POST /api/carrito/fusionar` | Carrito persistente (con sesión o anónimo con `X-Carrito-Id`) |
| `POST /api/checkout` | Compra transaccional con pago simulado, con cuenta o como invitado |
| `GET /api/ordenes`, `GET /api/ordenes/:id` | Órdenes del usuario (el invitado usa `X-Orden-Token`) |
| `POST /api/vitals` | Web Vitals del navegador (respaldo de GA4, va a Prometheus) |
| `/api/admin/*` | Panel de administración (solo rol admin) |

---

## Tests
- `npm test` en la raíz: backend (Vitest + Supertest sobre la base
  `subligol_test`; **requiere** `docker compose up -d db`) y frontend
  (`src/**/*.test.js`, con fetch y gtag simulados).
- Solo frontend: `npm run test:frontend`.
- Estado actual: 371 tests del backend y 85 del frontend.

---

## Analítica (GA4)
- Eventos: `page_view` (en cada cambio de ruta), `view_item_list`, `search`,
  `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`,
  `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`
  (con `tipo_cliente`), `login`, `sign_up` y `web_vitals`.
- `escenario_prueba`: se toma de la URL (`?escenario=normal`) y viaja con
  todos los eventos, para comparar la experiencia sin carga y bajo carga.
- Las rutas `/admin` no envían eventos (tráfico interno).
- **DebugView:** en `npm run dev` los eventos llevan `debug_mode`. También
  se puede usar Tag Assistant (tagassistant.google.com).
- **Configuración de Tag Manager (importante):** la etiqueta de Google se
  actualizó a un contenedor de Tag Manager (`GTM-TW4N4RM5`). En su etiqueta
  "Google Analytics G-6N9SYJYRHL" se configuró `send_page_view = false`
  (la SPA envía sus propios `page_view`) y se **desactivó** "Ignorar
  instancias duplicadas de configuración en la página" (si está activo, se
  ignora el `gtag('config')` del sitio y DebugView no muestra los eventos).
- Dimensiones personalizadas: `escenario_prueba`, `metric_name`,
  `metric_rating` y `tipo_cliente`; métrica personalizada `metric_value`;
  `purchase` marcado como evento clave.

## Monitoreo
- Grafana (http://127.0.0.1:3001) abre el dashboard **"Subligol – Desempeño"**
  (30 paneles): tráfico y latencia por ruta, recursos del equipo y de los
  contenedores, event loop y pool de PostgreSQL, base de datos y negocio, y
  Web Vitals (p75 por escenario).
- Consultas más costosas: `select queryid, query from pg_stat_statements`.

## Pruebas de carga
_Pendiente (Fase 1.2)._ El script `carga/k6/escenarios.js` (escenarios baja,
normal y estrés) reemplazará a los scripts preliminares de `load_tests/`,
que apuntan a rutas de la SPA y no miden el servidor.

---

## Decisiones de diseño
- **Búsqueda sin índices** (ILIKE): el índice `pg_trgm` queda como mejora a
  aplicar y volver a medir en la Fase 2.
- **Pago simulado** (`medio_pago "mock"`): bajo carga nunca se llama a un
  servicio de terceros (guía, sección 5.3).
- **Carrito anónimo en la base de datos** (`X-Carrito-Id`): el perfil de
  abandono de carrito de k6 también escribe en la base.
- **Compra como invitado** o con cuenta (los datos de despacho se completan
  con el último pedido).
- **Stock nunca negativo** (`CHECK`) y checkout que bloquea los productos en
  orden de id: sin sobreventa ni deadlocks.
- **Tres páginas con distinto peso** (home, catálogo y detalle) para que
  saturen a niveles distintos.
- **`/metrics` en un puerto interno** que no se publica.

## Pendientes
- Deploy en una VM con HTTPS (URL pública para el profesor y para GA4).
- Pruebas de carga con k6 (Fase 1.2) y análisis de desempeño (Fase 2).
- **Seguridad:** límite de intentos (rate limiting) en login y registro; no
  se aplica todavía porque interferiría con las pruebas de carga.
- **Panel:** auditoría de edición y activación de productos (migración 005,
  con un trigger `AFTER UPDATE OF` las columnas editables, **sin
  `stock_actual`**) y paginación del inventario en la interfaz.

---

## Convenciones
- Ramas: `main` (siempre desplegable) y ramas cortas `feat/...`
- Commits: Conventional Commits en español
- Instrucciones para el agente de codificación: `AGENTS.md` (`CLAUDE.md` apunta a él)
- Registro de prompts: solo los significativos, en `LogFile.txt`
