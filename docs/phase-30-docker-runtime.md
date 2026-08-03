# Phase 30 Docker Container Runtime Specification

## Dockerfile Structure
- Node.js 20 LTS Alpine base image.
- Multi-stage build (deps, builder, runner).
- Non-root user execution (`nextjs:nodejs`).
- Production environment variables: `NODE_ENV=production`.

## Operational Health Check
- Endpoint: `/api/health` or `/api/v1/health`.
- Checks: Database connectivity, Prisma Client readiness, local storage write permissions.
