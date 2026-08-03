# Phase 30 Environment Safety Specification

## Environment Protection Rules

### 1. Seed Preservation
- **Rule**: `CURRENT MARKETPLACE SEED DATA: FROZEN` & `FINAL MARKETPLACE RESEED: NOT AUTHORIZED`.
- **Enforcement**: No migration script or operational script deletes, resets, or re-seeds existing local database records.

### 2. External Provider Safety
- **Rule**: Unconfigured external service credentials MUST fail closed gracefully.
- **Enforcement**:
  - Missing PayFast merchant credentials return `PAYFAST_PROVIDER_NOT_CONFIGURED`.
  - Missing Email API keys return `EMAIL_PROVIDER_NOT_CONFIGURED`.
  - Missing SMS API keys return `SMS_PROVIDER_NOT_CONFIGURED`.
  - Missing Google Maps API keys fallback to safe server-side estimation with `GOOGLE_MAPS_NOT_CONFIGURED` status.

### 3. Production Lock Matrix
- All phase production locks (e.g. `REPORTING_PRODUCTION_VALIDATION_APPROVED`, `PAYFAST_PRODUCTION_VALIDATION_APPROVED`, etc.) remain `false` until explicit architect signoff.
