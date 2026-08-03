# Phase 29 Reporting & Controlled Exports Architecture

## Overview
Phase 29 introduces the secure Reporting, Analytics, and Controlled Exports authority for the KT Couriers platform. It operates strictly as a read projection authority over existing domain authorities (Orders, Payments, Marketplace, Driver Earnings, Store Earnings, Promoters, Developer API, etc.).

## Key Components
- **Catalog & Contracts** (`lib/reporting/contracts.ts`): Catalog of approved report definitions across Customer, Store, Driver, Promoter, Developer, and Administration audiences.
- **CSV Sanitizer & Anti-Formula Injection** (`lib/reporting/csv-sanitizer.ts`): Strips/escapes formula injection prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quote prefixing to protect against spreadsheet macro execution vulnerabilities.
- **Projection Builder** (`lib/reporting/report-generator.ts`): Safe, tenant-scoped projection queries.
- **Job & Download Lifecycle** (`lib/reporting/services.ts`): Async report generation, SHA-256 artifact verification, and short-lived HMAC signed download tokens.
- **Reconciliation Engine** (`lib/reporting/reconciliation.ts`): Automated scanner for stuck jobs, missing artifact files, and checksum mismatches.
- **Composition Root** (`lib/reporting/composition-root.ts`): Failsafe subsystem initialization with production lock enforcement.

## Production Lock State
- `REPORTING_PRODUCTION_VALIDATION_APPROVED` remains set to `false` until final signoff.
