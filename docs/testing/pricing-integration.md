# Pricing Integration Tests

Run:

```bash
npm run test:integration:pricing
```

The suite starts a uniquely named disposable PostgreSQL Compose project, deploys migrations, seeds deterministic fixtures, then proves quote creation, normalized input hashing, rule selection/conflict behavior, immutable snapshots, expiry, and one-time consumption under concurrency. It tears down only that project and volume.

The customer UI and pricing-admin browser flows are covered separately by `npm run test:e2e`.
