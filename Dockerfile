FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN sh -c 'for i in 1 2 3 4 5; do apt-get update -y && apt-get install -y --no-install-recommends --fix-missing openssl ca-certificates && rm -rf /var/lib/apt/lists/* && exit 0; echo "apt install failed (attempt $i), retrying..."; sleep 6; done; exit 1'

COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN corepack enable \
 && npm config set fetch-retries 8 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-mintimeout 10000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-timeout 300000 \
 && npm config set registry https://registry.npmjs.org/ \
 && sh -c 'for i in 1 2 3; do if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile --ignore-scripts; else npm ci --ignore-scripts; fi && exit 0; echo "deps install failed (attempt $i), retrying..."; sleep 8; done; exit 1'

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN sh -c 'for i in 1 2 3 4 5; do apt-get update -y && apt-get install -y --no-install-recommends --fix-missing openssl ca-certificates && rm -rf /var/lib/apt/lists/* && exit 0; echo "apt install failed (attempt $i), retrying..."; sleep 6; done; exit 1'

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN sh -c 'for i in 1 2 3 4 5; do npx prisma generate && exit 0; echo "prisma generate failed (attempt $i), retrying..."; sleep 6; done; exit 1'
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN sh -c 'for i in 1 2 3 4 5; do apt-get update -y && apt-get install -y --no-install-recommends --fix-missing openssl ca-certificates && rm -rf /var/lib/apt/lists/* && exit 0; echo "apt install failed (attempt $i), retrying..."; sleep 6; done; exit 1'

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
