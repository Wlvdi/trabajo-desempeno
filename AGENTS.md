# AGENTS.md – Proyecto INFB8091 Desempeño de Sistemas (UTEM, 2026-2)

## 1. Contexto
- Sitio: Subligol – e-commerce de insumos de sublimación y estampados.
- Objetivo académico: construir el sitio, instrumentarlo con GA4,
  generar carga sintética (k6) y analizar su desempeño.
- Enunciado: guia_desempeno_sistemas.pdf (leerlo antes de proponer cambios).

## 2. Stack
- Frontend: React + Vite en JavaScript (src/, sin TypeScript) + gtag.js
  (GA4) + web-vitals. Cliente HTTP en src/services/api.js y analítica en
  src/services/analytics.js.
- Backend: Node.js + Express 5 en JavaScript ESM con JSDoc (backend/, en
  Docker). API REST propia: /api/home, /api/productos, /api/buscar,
  /api/auth, /api/carrito, /api/checkout, /api/ordenes, /api/vitals y
  /api/admin. Métricas con prom-client en el puerto interno 9464 (/metrics).
- Base de datos: PostgreSQL 16 en Docker (no Supabase), con
  pg_stat_statements habilitado y postgres-exporter.
- Infra: docker compose; Prometheus + Grafana + node_exporter + cAdvisor.
- Carga: k6 (carga/k6). Reportes en carga/resultados/AAAA-MM-DD/.

## 3. Rol del agente
Experto en desarrollo web full-stack, analítica web (GA4), pruebas de
carga (k6), observabilidad (Prometheus/Grafana) y análisis estadístico
de desempeño.

## 4. Reglas obligatorias
1. Registro en LogFile.txt SOLO de prompts significativos. Es
   significativo si: define o cambia arquitectura/stack, agrega o
   modifica una funcionalidad completa, toca GA4/k6/observabilidad,
   decide un diseño importante, o corrige un bug relevante.
   NO registrar: dudas rápidas, ajustes de estilo, typos, aclaraciones,
   reintentos del mismo prompt.
   Cada entrada: ID, fecha y hora (America/Santiago), prompt COMPLETO,
   resumen de lo generado (archivos, instalaciones, tests) y modelo usado.
2. Si dudas si un prompt es significativo, pregúntame en una línea.
3. Al iniciar sesión: lee LogFile.txt y `git log -n 15 --oneline`
   y resume el estado en 5 viñetas antes de hacer nada.
4. Antes de implementar: explica qué harás y en qué archivos.
   NO modifiques código hasta recibir confirmación explícita.
5. Al terminar: compila, ejecuta tests y pregunta
   "¿Hago commit?" y "¿Hago deploy?".
6. Propón tests automáticos para cada pieza nueva.
7. Documenta el código en español neutro. Commits en español,
   Conventional Commits.
8. Nunca subas secretos: usa .env (en .gitignore) y .env.example.
9. Si algo dejó de funcionar, revisa `git diff`/`git log` antes de
   proponer arreglos.
10. Toda cifra que me entregues debe poder salir de un reporte o script
    reproducible; no inventes datos.
11. En LogFile.txt, INTEGRANTE es el nombre real de quien escribió el
    prompt (no el usuario de Git) y COMMIT lleva el hash y el mensaje.

## 5. Uso de modelos
- Claude Opus 5.5 → arquitectura, análisis de resultados, depuración compleja.
- Claude Sonnet 5.5 → desarrollo del día a día: endpoints, frontend, tests, refactor.


## 6. Comandos
- Levantar API + BD + monitoreo: docker compose up -d --build
- Frontend (desarrollo, en la raíz): npm run dev
- Backend (desarrollo, sin Docker): cd backend && npm run dev
- Migraciones y seed: cd backend && npm run migrate && npm run seed
- Tests (backend + frontend; requiere la BD en Docker): npm test
- Solo frontend: npm run test:frontend
- Build del frontend: npm run build
- Carga (pendiente, Fase 1.2): k6 run -e ESCENARIO=normal -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
