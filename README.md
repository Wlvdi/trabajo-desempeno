# [COMPLETAR: nombre del comercio]
Proyecto del curso INFB8091 Desempeño de Sistemas (UTEM, 2026-2).
Sitio de e-commerce de [Sublimación & Estampados], construido para medir su
desempeño bajo carga.

## Integrantes
- [Wladimir Gallardo]
- [Rodrigo Donoso]
- [Leonardo ...]

## Enlaces
- Sitio desplegado: [COMPLETAR: URL]
- Repositorio: [COMPLETAR: URL]

## Stack
- Frontend: React + Vite (TypeScript), gtag.js (GA4), web-vitals
- Backend: Node.js + Express + PostgreSQL (Docker), prom-client
- Infra: Docker Compose, Prometheus, Grafana, node_exporter
- Carga: k6

## Requisitos
- Node.js
- Docker y Docker Compose
- k6

## Cómo levantar el proyecto
1. Copiar `.env.example` a `.env` y completar las variables.
2. Levantar API, base de datos y monitoreo: `docker compose up -d`
3. Migraciones y seed: `cd backend && npm run migrate && npm run seed`
4. Frontend: `cd frontend && npm install && npm run dev`

## Tests
- Unitarios e integración: `npm test`
- E2E: `npx playwright test`

## Pruebas de carga
```bash
k6 run -e ESCENARIO=baja   -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
k6 run -e ESCENARIO=normal -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
k6 run -e ESCENARIO=estres -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
```
Los reportes quedan en `carga/resultados/`.

## Estructura
- `frontend/` sitio web
- `backend/` API REST, migraciones y seeds
- `infra/` docker-compose, Prometheus y Grafana
- `carga/` scripts k6 y resultados
- `analisis/` scripts de análisis estadístico
- `docs/` enunciado, capturas de GA4, arquitectura e informe

## Convenciones
- Ramas: `main` (siempre desplegable) y ramas cortas `feat/...`
- Commits: Conventional Commits en español
- Instrucciones para el agente: ver `AGENTS.md`
