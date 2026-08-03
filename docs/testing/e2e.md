# Chromium E2E

Run:

```bash
npm run test:e2e
```

This builds and starts the production Docker image against a unique disposable Compose database, waits for liveness and readiness, then runs serialized Chromium scenarios. The scenarios cover customer quote → changed-input invalidation → order submission → replay rejection, pricing administration (create, conflict, revise, archive), and admin dispatch → driver acceptance → retry/idempotency behavior.

Deterministic route coordinates and route data are available only through explicit E2E environment flags. They are not a production fallback. Failed browser attempts retain trace, screenshot, and video artifacts; the disposable Compose project is cleaned up in all cases.
