# Ledger integration testing

The Phase 9 live suite is written for a uniquely named disposable PostgreSQL Compose project. It never targets or removes the canonical `kt-couriers` project or `kt_couriers_postgres_baselined_clean` volume.

## User-run command

After implementation review, run:

```bash
npm run test:integration:ledger
```

The runner starts an isolated PostgreSQL service, deploys the full migration chain, runs the development seed twice, executes the legacy ledger preflight, runs only `vitest.ledger-integration.config.ts`, runs the final invariant verifier, and removes only its generated Phase 9 project and volumes.

Do not point `DATABASE_URL` at production or shared data. The script generates its own local database, user, password, port, and Compose project name.

## Encoded scenarios

- balanced journal evidence and account projections;
- unbalanced all-or-nothing rejection;
- same-key replay and changed-payload conflict;
- concurrent same-key posting;
- double-spend prevention;
- opposite caller account-order transfers;
- independent account concurrency;
- disposable transaction rollback after evidence insertion;
- frozen and closed account rejection;
- wallet/account currency mismatch rejection;
- exact reversal and original immutability;
- concurrent and second reversal behavior;
- reversal non-negative enforcement;
- deliberate projection tamper detection;
- twice-seeded platform consistency;
- delivery completion without ledger posting.

## Standalone read-only checks

Before migration, run `npm run db:preflight:ledger`. After migration/seed/posting tests, run `npm run db:verify:ledger`. Both scripts print aggregate, non-sensitive results and exit non-zero on failure. The preflight does not alter legacy data. The verifier does not repair projections.

## E2E

The normal disposable E2E runner creates one balanced fixture and its reversal, plus an admin with an explicit `ledger.read` denial. Run the ledger-only flow with:

```bash
npm run test:e2e -- --grep "read-only admin ledger"
```

The test uses exact headings, labelled filters, named tables, visible body text for leak checks, and verifies the absence of mutation controls.

## Deferred validation

The implementation agent does not run Docker, migrations, seed, integration, E2E, build, coverage, or full-suite commands. Those operations belong to the user validation gate after code review.
