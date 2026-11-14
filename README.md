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
- Frontend: React 18 + Vite 6 (JavaScript, `.jsx`), Tailwind CSS, react-router.
- Datos: el navegador consulta **Supabase** directamente (`src/services/api.js`
  y `src/context/AuthContext.jsx`). Si Supabase no está configurado, usa datos
  de ejemplo guardados en `localStorage`.
- Base de datos: PostgreSQL en Supabase; scripts SQL en `database/`.
- Analítica: GA4 (gtag.js) y web-vitals en `src/services/analytics.js`.
- Carga: scripts preliminares en `load_tests/` (k6 y Locust).
- Aún no hay: backend propio, Docker, Prometheus/Grafana, tests automáticos ni deploy.

### Requisitos
- Node.js 20 o superior
- (Opcional) Proyecto Supabase con los scripts de `database/` ejecutados
- (Opcional) k6

### Cómo levantar el proyecto hoy
1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env.local` y completar `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` y `VITE_GA_MEASUREMENT_ID`.
   Sin credenciales de Supabase el sitio funciona en modo local con datos de ejemplo.
3. Servidor de desarrollo: `npm run dev` (http://localhost:5173)
4. Build de producción: `npm run build`

### Estructura actual
- `src/` sitio web (tienda en `src/views/store/`, panel admin en `src/views/`)
- `database/` scripts SQL de Supabase (tablas, triggers, vistas, RLS, seed)
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
- `docs/` guía/enunciado, capturas de GA4, arquitectura e informe

---

## Convenciones
- Ramas: `main` (siempre desplegable) y ramas cortas `feat/...`
- Commits: Conventional Commits en español
- Instrucciones para el agente: ver `AGENTS.md` (`CLAUDE.md` apunta a él)
- Registro de prompts: solo los significativos, en `LogFile.txt`
