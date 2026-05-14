FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
COPY package.json package-lock.json ./
RUN npm config set fetch-retries 8 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 300000 \
 && sh -c 'for i in 1 2 3 4 5; do npm ci --ignore-scripts && exit 0; echo "npm ci failed (attempt $i), retrying in 12s..."; sleep 12; done; exit 1'

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN sh -c 'for i in 1 2 3 4 5; do npx prisma generate && exit 0; echo "prisma generate failed (attempt $i), retrying in 8s..."; sleep 8; done; exit 1'
RUN sh -c 'for i in 1 2 3; do npm run build && exit 0; echo "app build failed (attempt $i), retrying in 10s..."; sleep 10; done; exit 1'

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000
CMD ["/app/entrypoint.sh"]

FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json
COPY prisma ./prisma
COPY src ./src
CMD ["npm", "run", "worker:queues"]
