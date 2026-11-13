# Processor implementation status

This is a partial inventory, not a certification of all processors. See `PHASE3_WORKER_SCOPE_REVIEW_2026-11-13.md` and the processor registry for the full existing inventory.

| Processor | Current state | Required work |
| --- | --- | --- |
| Queued report generation | `scripts/generate-report-jobs.mjs` only lists jobs; IMPLEMENTED_SOURCE applies to the underlying report service and new storage/race protections, not a functioning runner. | Implement a bounded, recoverable runner with isolation, durable storage, authorization and concurrency tests. |
| Expired promotions | `scripts/end-expired-promotions.mjs` has no real candidate query or transition; promotion production validation remains locked. | Implement and verify canonical state transitions, idempotency, accounting consequences and recovery before activation. |
| Other registered disabled capabilities | Refer to the registry and worker scope review; some domain services exist independently of a running worker. | Complete capability-by-capability implementation and isolation tests; retain locks until each is proven. |

No worker is enabled or scheduled by this report.
