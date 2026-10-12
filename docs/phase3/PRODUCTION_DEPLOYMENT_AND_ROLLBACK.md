# Production deployment and rollback

No production release was performed. The current Vercel deployment and both Railway services remain on older source `83a4d63078efa20d4e234fe081c10e15746387d1`. Git-based deployment quarantine remains active. The exact `main` candidate `f30d2feb2172c32c709b4f0e173595eabe138d00` is not live: Railway's web and operations-worker records are `SKIPPED`, and Vercel's latest production deployment remains the older `dpl_5c9MCebLdhMKGp8XYJWV15HLiZKL`.

Before any release, an operator must approve the exact SHA, deployment order, migration write set, backup and isolated restore, provider activation, monitoring thresholds and rollback/forward-repair steps. Preserve the active operations processor when resolving the staged patch. A Vercel rollback does not undo database migrations; do not use an unreviewed down migration. See [routing proof](VERCEL_RAILWAY_ROUTING_PROOF.md), [infrastructure inventory](INFRASTRUCTURE_INVENTORY.md) and [GO/NO-GO](GO_NO_GO.md).
