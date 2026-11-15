# Frontend de Subligol servido por Caddy (HTTPS automático + proxy a la API).
# Build: docker compose -f docker-compose.yml -f docker-compose.prod.yml build web

# --- 1. Compilar la tienda (Vite) ---------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY src ./src
# El ID de GA4 se incrusta en el build (Vite lee las variables VITE_* al compilar).
ARG VITE_GA_MEASUREMENT_ID=
ARG VITE_GA_DEBUG=false
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID VITE_GA_DEBUG=$VITE_GA_DEBUG
RUN npm run build

# --- 2. Servirla con Caddy ----------------------------------------------------
FROM caddy:2.10.0-alpine
COPY infra/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
