# Dispatch Integration Tests

Run:

```bash
npm run test:integration:dispatch
```

The suite uses an isolated disposable PostgreSQL project and verifies deterministic eligibility/ranking, concurrent assignment protection, offer/accept/reject lifecycle behavior, retries, capacity enforcement, reassign/unassign, and custody boundaries. It does not use or erase the normal development database volume.
