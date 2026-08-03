# Phase 29 Database Migration Manifest

## Schema Changes
Phase 29 schema changes add reporting models to `prisma/schema.prisma`:

- `ReportJob`: Async job tracking model with status, parameters, requester references, and error logs.
- `ReportArtifact`: Export file metadata storing SHA-256 checksums, byte sizes, storage paths, and download expirations.
- `ReportExecutionLog`: Audit log capturing definition execution times, row counts, requester IPs, and execution durations.

## Enums
- `ReportJobStatus`: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`, `CANCELLED`.
- `ReportExportFormat`: `CSV`, `JSON`, `PDF`.
- `ReportExecutionMode`: `SYNCHRONOUS_INLINE`, `ASYNCHRONOUS_EXPORT`.

## Migration Verification
- Validated via `npx prisma validate`.
- Client generated via `npx prisma generate`.
- Seed data policy enforced: No reseed or data deletion performed.
