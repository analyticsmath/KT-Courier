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
RUN npm ci --ignore-scripts --fetch-retries=5 --fetch-retry-factor=2 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000 --fetch-timeout=120000

COPY prisma ./prisma
RUN npx prisma generate

FROM base AS builder

ARG NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES
ENV NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES=${NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES}
ARG KT_NEXT_BUILD_CPUS=1
ENV KT_NEXT_BUILD_CPUS=${KT_NEXT_BUILD_CPUS}
ENV NODE_OPTIONS="--max-old-space-size=2048"

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json
COPY --from=dependencies /app/package-lock.json ./package-lock.json
COPY --from=dependencies /app/prisma ./prisma
COPY . .

RUN node --max-old-space-size=2048 ./node_modules/next/dist/bin/next build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Keep Prisma migration tooling in the production image so platform pre-deploy
# migrations run deterministically without npx downloading packages at runtime.
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=dependencies --chown=nextjs:nodejs /app/prisma ./prisma

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# One-time production catalogue initialization assets. The source files are
# needed by the guarded pre-deploy initializer; catalogue media is uploaded to
# durable object storage before the web runtime is promoted.
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/types ./types
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/var/catalog-media ./var/catalog-media

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

FROM base AS worker

ENV NODE_ENV=production

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node lib ./lib
COPY --chown=node:node types ./types
COPY --chown=node:node scripts ./scripts

USER node

CMD ["node", "node_modules/tsx/dist/cli.mjs", "scripts/background-worker.ts"]

FROM base AS scheduler

ENV NODE_ENV=production

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node lib ./lib
COPY --chown=node:node types ./types
COPY --chown=node:node scripts ./scripts

USER node

CMD ["node", "node_modules/tsx/dist/cli.mjs", "scripts/scheduler-runner.ts"]

# Default build target for platforms that auto-detect the root Dockerfile (e.g. Railway).
# Named Compose targets above remain available for migrator/worker/scheduler services.
FROM runner AS default-web
