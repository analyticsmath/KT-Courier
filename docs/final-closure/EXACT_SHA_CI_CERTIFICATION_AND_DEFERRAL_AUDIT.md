# Exact-source certification

Local source `fc276e13686afaebf5822149ecf9836036ebd6d4`, tree `2a55e60e262a62f542ffb3362ff6c272443a6b13`; Node 24.18.0, Next 16.3.8, synthetic/offline providers, fresh guarded databases and run-scoped cleanup. Build: PASS, 522 generated routes. Lint, typecheck, Prisma validate and 80-migration source safety passed. Initial local parallel runs hit Redis-environment branch mismatch and timing limits; failed receipts remain in ignored command-receipt history and are not counted as passes. Reruns use an explicitly unconfigured unit Redis environment and sequential heavy local checks.

| Selection | Actual source | Actual status | Passed | Failed | Skipped | Flaky |
|---|---|---|---:|---:|---:|---:|
| test:coverage | 98a6801f | PASS | 3795 | 0 | 0 | 0 |
| test:integration:closure | 98a6801f | PASS | 190 | 0 | 0 | 0 |
| test:integration:redis-rate-limit | 85514600 | PASS | 7 | 0 | 0 | 0 |
| test:integration:bola-authority | 85514600 | PASS | 10 | 0 | 0 | 0 |
| test:e2e | fc276e13 | FAIL | 0 | 1 | 0 | 0 |

[Application-source CI](https://github.com/analyticsmath/KT-Courier/actions/runs/38293182621) and [superseded partial certification](https://github.com/analyticsmath/KT-Courier/actions/runs/38288990489) have distinct source anchors: current baseline CI checks fc276e13; the superseded run checked 85514600, passed 23 components and was cancelled after the saved-draft bug was reproduced. It is not final certification. The 20 PostgreSQL matrix commands and all five browser stages are preserved. Required browser counts: directed 43, finance 3, offline Paystack 9, dynamically discovered full Chromium (previous 140, now includes the new case), canonical PostgreSQL 41. No narrowed selection substitutes for full acceptance. Ten applicable push-CI jobs and eighteen conditional skips are distinct from 24 manual components. The final `certified` gate must remain NOT_READY until nine actual launch gates close.

AST audit retains 65 marker files and zero active release-critical OPEN_ENGINEERING placeholders; conditional guarded tests must actually execute in disposable suites. Optional subscriptions/promoters/advertising/recruitment and legacy PayFast exclusions remain scoped and are not passes. Independent QA exclusion review is OPEN. Static inventory and an old green run do not certify a new checkout.

After the dossier commit, dispatch the existing manual workflow against final `main`, verify its checkout SHA and all 24 jobs, and retain artifact hashes/IDs in the final response/Actions evidence. The manifest's at-commit status is deliberately NOT_RUN until those hosted artifacts exist; no self-referential source SHA is fabricated.

At snapshot, the new linked case is FAIL at the mobile-button test selector; only its earlier signup/catalog/publication/capture checkpoints completed. The corrected successor workflow adds an explicit one-case receipt plus all unchanged full selections. Linux certification uses six isolated Docker app builds to preserve Next traced dependencies; each session still has its own database, Redis and blocked egress. Later final-checkout results must be taken from that exact Actions run, not inferred from this snapshot.

[cd87ba48 attempt](https://github.com/analyticsmath/KT-Courier/actions/runs/38297246475) passed all 23 non-browser components but failed browser startup before test discovery: the shared standalone bridge omitted a Linux Next traced Prisma alias. No browser PASS or zero-test success is recorded. The successor restores the existing Docker app-build path; the dedicated one-case count guard, 20 PostgreSQL commands and all full browser selections remain unchanged. The local Windows bridge is not evidence of Linux runtime compatibility.
