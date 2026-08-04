FROM node:24-bookworm-slim AS base
WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies

COPY package.json package-lock.json ./
# Keep the lockfile authoritative. The cache and bounded retries make slow
# Docker Desktop proxy fetches observable/recoverable without weakening npm
# integrity or TLS verification.
RUN --mount=type=cache,target=/root/.npm \
  npm ci --fetch-retries=3 --fetch-retry-factor=2 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 --fetch-timeout=120000

COPY prisma ./prisma
RUN npx prisma generate

FROM base AS builder

ARG NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES
ENV NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES=${NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES}
ENV NEXT_PRIVATE_WORKERS=2

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=dependencies /app/package-lock.json ./package-lock.json
COPY --from=dependencies /app/prisma ./prisma
COPY . .

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

FROM base AS migrator

ENV NODE_ENV=production

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node lib ./lib
COPY --chown=node:node types ./types
COPY --chown=node:node scripts ./scripts

USER node

CMD ["npx", "prisma", "migrate", "deploy"]
