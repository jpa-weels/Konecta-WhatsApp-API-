FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json .npmrc ./

# Aumenta heap do Node durante o install e usa legacy-peer-deps
# para evitar conflitos de versão de dependências transitivas
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN mkdir -p /app/sessions

EXPOSE 4000

CMD ["node", "dist/index.js"]
