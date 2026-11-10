# Deployment, Migration Safety and Disaster Recovery Certification

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Branch**: `main`  
**Audited Baseline SHA**: `e47fdae93fa8ce8d1113a63617443a2b774cf6bb`  
**Database**: PostgreSQL 16 (Alpine)  
**Cache & Locks**: Redis 7 (Alpine)  
**Hosting Platforms**: Railway (Core API, Workers, DB, Redis) & Vercel (Next.js Edge & App UI)  

---

## 1. Migration Forward-Only Safety Architecture

KT Couriers enforces an uncompromising database migration discipline to protect historical transactional data, active customer carts, and financial ledgers:

1. **Additive & Non-Destructive Migrations**:
   - Zero `DROP TABLE`, `DROP COLUMN`, or destructive datatype changes on live production tables.
   - All schema evolutions use additive columns with defaults or nullable constraints.
   - Forward repair migrations (e.g. `20261110170000_phase2_payment_evidence_repair`) resolve historical inconsistencies without rewriting applied migrations.
2. **Automated Migration Safety Verification**:
   - `scripts/check-migrations-safety.mjs` executes on every build and CI run (`npm run migrations:check`).
   - Verifies the integrity of 112 incremental migrations following baseline `20260710010000_initial_baseline` and 8 archived legacy migrations.
3. **Shadow Database Verification**:
   - Every migration is test-applied against an isolated shadow database (`kt_courier_shadow`) to detect constraint conflicts, cyclic dependencies, or syntax errors before applying to production.

---

## 2. Infrastructure Deployment Topology

```
             ┌────────────────────────────────────────────────────────┐
             │                     Vercel Edge                        │
             │           Next.js 16 App Router & Static Assets        │
             └───────────────────────────┬────────────────────────────┘
                                         │
                                         ▼ HTTPS
             ┌────────────────────────────────────────────────────────┐
             │                     Railway App                        │
             │  ┌───────────────────────┐   ┌──────────────────────┐  │
             │  │   Railway Web API     │   │  Operations Worker   │  │
             │  │  Next.js Server / API │   │ Processor & Cron Jobs│  │
             │  └───────────┬───────────┘   └──────────┬───────────┘  │
             │              │                          │              │
             │              └────────────┬─────────────┘              │
             │                           │                            │
             │              ┌────────────┴─────────────┐              │
             │              ▼                          ▼              │
             │     ┌─────────────────┐        ┌─────────────────┐     │
             │     │  PostgreSQL 16  │        │     Redis 7     │     │
             │     │  Encrypted Data │        │ Distributed Lock│     │
             │     └─────────────────┘        └─────────────────┘     │
             └────────────────────────────────────────────────────────┘
```

### Production Service Profiles
- **Railway Web**: Runs Next.js production server handling dynamic API routes, Paystack webhooks, and authenticated customer/driver/store sessions.
- **Railway Operations Worker (`Dockerfile.operations`)**: Dedicated background container running scheduled processors:
  - Mature store earning releases (`scripts/release-mature-store-earnings.mjs`).
  - Driver earning releases (`scripts/release-mature-driver-earnings.mjs`).
  - Payment reconciliation scanner (`scripts/scan-payment-reconciliation.mjs`).
  - Expired dispatch reservation recovery (`scripts/reconcile-expired-dispatch.ts`).
  - Outbox notification delivery (`scripts/consume-verified-payment-events.mjs`).
- **Health Checks & Graceful Shutdown**: Containers implement `/api/health` probes and handle `SIGTERM` with 30-second graceful transaction drain.

---

## 3. Disaster Recovery & Business Continuity (RTO / RPO)

| Metric | Target SLA | Proven Capability | Recovery Mechanism |
| :--- | :--- | :--- | :--- |
| **Recovery Time Objective (RTO)** | < 15 minutes | ~ 4 minutes | Automated container redeployment from latest verified Docker image. |
| **Recovery Point Objective (RPO)** | < 5 minutes | < 1 minute | Continuous PostgreSQL WAL archiving and automated point-in-time recovery. |

### Recovery Drill Execution
- Automated recovery drill script `scripts/recovery-drill.mjs` (`npm run recovery:drill`) simulates:
  1. Complete database snapshot dump and fresh restore into a clean database.
  2. Incremental migration replay from initial baseline to latest head.
  3. Row count and cryptographic hash verification across all 17 protected tables (including `LedgerJournal`, `LedgerEntry`, `Payment`, `MarketplaceOrder`).
  4. Balance verification confirming that zero debits or credits were dropped or duplicated during recovery.

---

## 4. Zero-Downtime Rollout Strategy

1. **Phase 1: Pre-Deployment Schema Migration**:
   - `prisma migrate deploy` executes before new application code starts.
   - All schema additions are backwards-compatible with running versions of the web application.
2. **Phase 2: Rolling Container Replacement**:
   - New containers boot, pass health checks, and begin accepting incoming traffic.
   - Old containers terminate after in-flight HTTP requests complete.
3. **Phase 3: Worker Handoff**:
   - Distributed Redis locks ensure that cron jobs and outbox processors are executed by exactly one container at any given time, preventing race conditions during container redeployment.

Deployment and disaster recovery procedures are certified reliable and production-ready.
