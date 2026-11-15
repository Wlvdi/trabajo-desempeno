# Subligol
Proyecto del curso INFB8091 Desempeño de Sistemas (UTEM, 2026-2).
Sitio de e-commerce de sublimación y estampados, construido para medir su
desempeño bajo carga.

## Integrantes
- Wladimir Gallardo
- Rodrigo Donoso
- Leonardo [COMPLETAR: apellido]

## Enlaces
- Sitio desplegado: [COMPLETAR: URL]
- Repositorio: [COMPLETAR: URL]

> **Nota:** el proyecto está en migración. La sección **Estado actual**
> describe lo que funciona hoy; la sección **Arquitectura objetivo** describe
> hacia dónde vamos. Al terminar la migración se dejará solo la versión final.

---

## Estado actual

### Stack
- Frontend: React 18 + Vite 6 (JavaScript, `.jsx`), Tailwind CSS, react-router,
  en `src/`. Consume la API propia mediante `src/services/api.js`; ya no usa Supabase.
- Backend: Node.js + Express 5 en Docker (`backend/`): catálogo, búsqueda,
  auth (argon2id + JWT), carrito persistente, checkout con pago simulado,
  órdenes y métricas con prom-client en `/metrics`.
- Base de datos: PostgreSQL 16 en Docker, con migraciones y seed determinista
  en `backend/`.
- Monitoreo: Prometheus, Grafana y exporters en `docker-compose.yml`.
- Analítica: GA4 (gtag.js) y web-vitals en `src/services/analytics.js`.
- Pago: **simulado** (medio_pago `mock`, sin llamar a Transbank). La
  integración con el sandbox real de Webpay será un commit posterior.
- Panel de administración (`/admin`): requiere rol admin y consume
  `/api/admin` (productos, categorías, compras, ventas manuales, dashboard y
  auditoría). No envía eventos a GA4 ni Web Vitals (tráfico interno).

### Requisitos
- Node.js 22 o superior
- Docker y Docker Compose
- (Opcional) k6

### Cómo levantar el proyecto
1. Copiar `.env.example` a `.env` y completar las variables
   (`POSTGRES_PASSWORD`, `JWT_SECRETO`, `SEED_CONTRASENA_*`, `PAGO_MOCK=true`).
2. API, base de datos y monitoreo: `docker compose up -d --build`
3. Migraciones y seed: `cd backend && npm ci && npm run migrate && npm run seed`
4. Frontend: `npm install && npm run dev` (http://localhost:5173). Vite
   reenvía `/api` a http://localhost:3000.
5. Build de producción del frontend: `npm run build`

### Tests
- `npm test` en la raíz: tests del backend (requieren la base de datos en
  Docker) y del frontend (`src/**/*.test.js`, con fetch simulado).
- Solo frontend: `npm run test:frontend`.

### Estructura actual
- `src/` sitio web (tienda en `src/views/store/`, panel admin en `src/views/`)
- `backend/` API REST, migraciones, seed y tests
- `infra/` configuración de Prometheus y Grafana
- `carga/` datos y scripts de k6
- `load_tests/` scripts preliminares de k6 y Locust
- `guia_desempeno_sistemas.pdf` guía del trabajo

---

## Arquitectura objetivo

### Stack
- Frontend: React + Vite (TypeScript), gtag.js (GA4), web-vitals
- Backend: Node.js + Express (Docker), API REST propia, prom-client en `/metrics`
- Base de datos: PostgreSQL 16 (Docker) con pg_stat_statements y postgres-exporter
- Infra: Docker Compose, Prometheus, Grafana, node_exporter, cAdvisor
- Carga: k6

### Requisitos
- Node.js
- Docker y Docker Compose
- k6

### Cómo levantar el proyecto
1. Copiar `.env.example` a `.env` y completar las variables.
2. Levantar API, base de datos y monitoreo: `docker compose up -d`
3. Migraciones y seed: `cd backend && npm run migrate && npm run seed`
4. Frontend: `cd frontend && npm install && npm run dev`

### Tests
- Unitarios e integración: `npm test`
- E2E: `npx playwright test`

### Pruebas de carga
```bash
k6 run -e ESCENARIO=baja   -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
k6 run -e ESCENARIO=normal -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
k6 run -e ESCENARIO=estres -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
```
Los reportes quedan en `carga/resultados/AAAA-MM-DD/`.

### Estructura
- `frontend/` sitio web
- `backend/` API REST, migraciones y seeds
- `infra/` docker-compose, Prometheus y Grafana
- `carga/` scripts k6 y resultados
- `analisis/` scripts de análisis estadístico

---

## Mejoras de seguridad pendientes
- **Límite de intentos (rate limiting)** en `POST /api/auth/login` y
  `/api/auth/registro`: no se aplica por ahora porque interferiría con las
  pruebas de carga de la Fase 2. Antes de exponer el sitio en producción
  conviene limitar intentos por IP y por correo.

## Pendientes del panel de administración
- **Auditoría de edición y activación de productos** (migración 005): hoy
  solo se auditan la creación de productos, las compras y las ventas. Si se
  agrega, el trigger debe ser `AFTER UPDATE OF` las columnas editables
  (sku, nombre, descripcion, categoria_id, temporada, costo_unitario,
  precio_venta, stock_minimo, activo), **sin `stock_actual`**, para no
  auditar cada venta ni afectar las pruebas de carga.
- **Paginación del inventario en la interfaz**: el panel pide hasta 1000
  productos de una vez y muestra "Mostrando X de Y" si hay más.

---

## Convenciones
- Ramas: `main` (siempre desplegable) y ramas cortas `feat/...`
- Commits: Conventional Commits en español
- Instrucciones para el agente: ver `AGENTS.md` (`CLAUDE.md` apunta a él)
- Registro de prompts: solo los significativos, en `LogFile.txt`
