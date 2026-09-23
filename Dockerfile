# Etapa deps: dependencias + generación del cliente Prisma
FROM node:22-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate

# Etapa build: compila TypeScript
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Etapa producción: solo runtime
FROM node:22-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma/
EXPOSE 3000
# Aplica migraciones pendientes (idempotente; no borra datos) antes de arrancar
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]