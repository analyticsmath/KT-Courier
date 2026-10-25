# Phase 2 — isolated bounded HTTP capacity acceptance

**Scope:** P2-08, reproducible engineering measurement. This is NOT a live-production capacity certification, customer-load SLA, or release authorization. The thresholds here are **provisional engineering smoke targets**, subject to the operator's explicit production traffic assumptions and infrastructure acceptance.

## Source and safety

- Source: `scripts/phase2-bounded-capacity.mjs` and `tests/scripts/phase2-bounded-capacity.node-test.mjs`.
- Runs only inside the existing disposable E2E Docker harness **after** `api/health` and `api/ready` have passed, during its full Phase 1 Chromium stage. The same harness migrates and seeds a disposable PostgreSQL database, includes its own Redis, uses deterministic maps, console email, isolated Paystack keys, and blocks application external egress.
- The runner rejects any target except a literal HTTP `127.0.0.1`, `localhost`, or `::1` origin with a port and **also** requires E2E runtime, disabled networking, console email, and test payment mode. No production URLs or production credentials can be supplied as benchmark targets.
- All traffic is read-only GET. No checkout, COD, OTP, payment, deposit, refund, or dispatch operation is performed. No protected production tables are accessed.
- Guardrail test demonstrates refusal of public, LAN, hostname spoof, credential-bearing, and provider-connected targets before sending any request.

## Reproducible measurement protocol

Four scenarios: `/api/health`, `/api/ready`, `/quote`, `/shop`. Each uses **4 serial warmups** followed by **80 measured requests**, **4 concurrent workers**, **12-second per-request timeout**. There are precisely **320 measured GETs** and **16 warmups** in the full run, not an open-ended load attack. A scenario must have **zero non-200 responses or network errors**.

| Read-only route | Provisional p95 latency limit | Required successful measured requests |
| --- | ---: | ---: |
| Health | 2500 ms | 80/80 |
| Readiness | 2500 ms | 80/80 |
| Anonymous courier quote | 6000 ms | 80/80 |
| Public marketplace | 6000 ms | 80/80 |

Nearest-rank p50/p95/p99, maximum latency, HTTP response/error counts, elapsed time, aggregate throughput, exact commit SHA, and scenario outcomes are written to `output/production-closure/phase2-bounded-capacity.json`. The artifact is uploaded by Production Certification's browser job. Failing any route or losing the receipt fails that job, and the full Chromium suite cannot override the refusal. Results on a particular SHA **cannot be carried to a later commit**.

**Interpretation limits:** This proves only a four-worker synthetic read workload on CI hardware with fixture data. It does not prove peak-hour capacity, geocoder latency, full mixed checkout/dispatch writes, sustained concurrency, South African last-mile network conditions, live provider rate limits, operational SLOs, or production Railway/Vercel sizing. Those require a separately approved traffic profile, production-like controlled load setup, explicit error budget, and owner/infrastructure acceptance. Maintain launch `NOT_READY` until the independent launch register closes.
