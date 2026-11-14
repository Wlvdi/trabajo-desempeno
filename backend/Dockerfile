# Imagen de la API de Subligol.
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Instalar solo dependencias de producción (capa cacheable).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# No ejecutar como root.
USER node

EXPOSE 3000

# wget viene incluido en Alpine (busybox).
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud || exit 1

CMD ["node", "src/server.js"]
