# Baseline and source authority — 12 October 2026

Execution checkout: `D:\KT-Courier-integration`, clean `main` at `bd7a6dfb5920a8e8c06a0b772896164a931d4721`; fetch and fast-forward-only pull confirmed no remote movement. Other worktrees remain untouched. No new branch will be created.

Railway authenticated readback confirms both production Git services use the nonmatching watch path `/.release-control/approved-production-deploy-only-2026-10-12`. Both run source `83a4d63078efa20d4e234fe081c10e15746387d1`. Recent main pushes were SKIPPED. The live worker is the misleadingly named `query-storefront-categories`. Web predeploy runs migrations and initialization: no deployment is permitted without separate data/operator approvals.

Vercel CLI confirmed `analyticsmaths-projects/kt-courier`, project `prj_Q6i3g8JIv1ibkXGspPotBem2FFLD`, Node 24, and production deployment `dpl_5c9MCebLdhMKGp8XYJWV15HLiZKL` READY. Local `.vercel/project.json` matches the project/team and is ignored. The connector returned 403 for this scope; CLI fallback succeeds. Preview-disable effectiveness remains unproven. Source `vercel.json` continues disabling main/integration Git deployment. Its unconditional production rewrite is a reproducible P0 configuration defect to repair.

[Baseline main CI](https://github.com/analyticsmath/KT-Courier/actions/runs/38218735114) is SUCCESS at the baseline SHA. [New baseline manual certification](https://github.com/analyticsmath/KT-Courier/actions/runs/38224096916) was dispatched on main; completion and artifacts are pending, not asserted.

Client corpus: `docs/client-authority/2026-10/reviewed-client-documents.json`, `public-policies.json`, and README. README records prior owner clarification approving Express R5.50/km plus Small R5.50 / Medium R8.50 / Large R13.00; effective live activation, zones, parcel limits and remaining commercial policies require signed scope. Original DOCX binaries have not been independently verified in this execution. Preserve published policy provenance and do not invent a registered physical address.

Local Node is 24.18.0. Docker CLI is installed but its Linux engine was initially unavailable; local disposable integration execution must establish engine availability first. No production database URLs or secrets were requested.
