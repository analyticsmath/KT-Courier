# Railway staged patch decision

Decision: LEAVE_STAGED / BLOCKED_EXTERNAL. No accept, discard, credential change or service mutation performed.

Authenticated readback confirms production environment `2226be2a-86f7-4590-a7b4-72aa54dccf52`, patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb`, STAGED, five changes, destructive. Four fields create `paystack-credential-test`, including a redacted variable; the fifth deletes live operations processor `query-storefront-categories` (`fdd13e91-dffa-400e-9a44-ae2d1f891ff0`). Its active deployment remains `8220e084-6ad3-4467-b3d8-65afe8fe29ff` at `83a4d63078efa20d4e234fe081c10e15746387d1`.

The worker executes the reviewed-production audit and `scripts/production-processors.ts`, with `/health`. Current variable names, live config and deploy quarantine are recorded in `infra-baseline.json`; values are omitted.

Required operator action: independently review the exact pending diff and approve selective removal of the credential-test creation and worker deletion while preserving unrelated staged changes. No callable selective-discard tool has been established. If the UI/API only offers whole-patch accept/discard, the owner must resolve a reviewed operation separately. Never accept this entire patch. Capture before/after resource diff, worker capacity/health and named approver before closing this release blocker.
