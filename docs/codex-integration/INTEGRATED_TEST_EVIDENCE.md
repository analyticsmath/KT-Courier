# Integrated exact-source test evidence

**Superseded:** This historical report records source 6eed666775a30db5e7e4a70208c418072b76053b. Use [PHASE_2_FINAL_CLOSURE.md](PHASE_2_FINAL_CLOSURE.md) and [phase2-final-closure.json](phase2-final-closure.json) for the final exact-source evidence at aa0a3af7a80855161c8b8c0a065106abf019e7f5.

The earlier 6eed666 directed 42-case one-process selection timed out after 24 outputs, and its complete 139-case Chromium stage timed out after 84. Those outcomes remain historical failures. On aa0a3af7, the directed selection passed 42/42 in one process, the unchanged seven-stage plan passed its one-process full Chromium 139/139 stage, and canonical PostgreSQL passed 41/41 in one process.

All 36 current-source command receipts and stdout copies are in [test-receipts/phase2-final-aa0a3af7](test-receipts/phase2-final-aa0a3af7/). No hosted exact-SHA CI exists because Vercel preview isolation is unproven. The final decision remains PHASE_2_NOT_ACCEPTED, HOSTED_EVIDENCE_BLOCKED and PRODUCTION_NOT_READY.
