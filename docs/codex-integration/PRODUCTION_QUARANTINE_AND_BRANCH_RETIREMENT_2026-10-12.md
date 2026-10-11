# Production quarantine and branch-retirement decision — 12 October 2026

## Decision

No publication, main integration, or branch deletion is safe under the observed configuration. Keep the local candidate at 2cd712bbe1aa27717dc78ff732f87b9e8360cafe. Do not push the integration branch until a Vercel project owner supplies independent readback that the candidate branch cannot produce a routable preview connected to production.

Do not push main. Vercel production follows main, and Railway production web and processor also follow main. The Railway web pre-deploy invokes Prisma migration deployment and reviewed-client initialization/audit. A main push can therefore change live code, run migrations, or alter processor behavior.

## Quarantine facts

| Surface | Read-only observation | Safe disposition |
|---|---|---|
| Vercel preview | Prior Phase 1/2 branch previews exist. SSO applies except on custom domains. | No preview route requests. Project preview-disable setting was not returned by the project API and remains unconfirmed. |
| Vercel routing | Catch-all rewrite forwards to the live Railway web origin. | No candidate deployment until a platform-level branch exclusion or isolated staging project is observed. |
| Vercel production | Project kt-courier is connected to Git; production source is main at 83a4d63078efa20d4e234fe081c10e15746387d1. | No main push, domain reassignment, pause, or deployment. |
| Railway web | Service 55254aaf-3719-4da9-a5b6-9214417101c6 tracks main. Its pre-deploy includes prisma migrate deploy and reviewed-client scripts. | No source/config mutation, redeploy, migration, or service restart. |
| Railway processor | Service fdd13e91-dffa-400e-9a44-ae2d1f891ff0 tracks main and runs scripts/production-processors.ts. It is online. | Preserve the live worker. Never accept patch 9a3370a3-8d07-4ef9-9e8d-a57ff488fccb. |
| Railway pending patch | Patch 9a3370a3-8d07-4ef9-9e8d-a57ff488fccb remains STAGED, destructive, five changes; it creates a credential test and deletes the operations processor. | Leave staged state untouched pending Railway owner review. Do not accept, apply, blanket-discard, or run its credential test. |
| GitHub | No repository branch protection or rulesets were present in the read-only settings response; default Actions token is read-only and no Actions secrets or variables were listed. | No main integration. Ask repository owner to establish reviewed branch and workflow controls independently. |

The source-level Vercel configuration disables automatic deployment for the integration branch and leaves main unmatched. This config is committed locally, but neither its branch effect nor project-level preview status was independently read back. It is not P0 clearance.

## Branch preservation

No remote branch was deleted. Preserve:

- integration/codex-phase1-phase2-2026-10-11 at local candidate 2cd712bbe1aa27717dc78ff732f87b9e8360cafe.
- production-closure-2026-10-07 at remote tip 9612d8366e54e3492a80c53d63753b0af01a6c47 while PR 17 remains open; its four diagnostic files are not part of the integration candidate.
- phase2/antigravity-functional-completion-2026-10-11 at 3c79fce207800264b78e59a60bfcc4240ede6cc4.
- feat/legacy-6ammart-migration at e048266b8445cd0a6246871cdf976071fa2527f0; it contains five commits not in main and remains a unique history source.

The other historical merged branches remain intact. No archive bundle or restore drill was run because no deletion is authorized by the release state. Do not infer that a branch is disposable merely because its current tree overlaps main.

## Conditions before revisiting this decision

1. A Vercel owner provides project-ID-bound readback of a documented preview exclusion that applies to this integration branch and preserves the current production aliases; alternatively, a fully isolated Vercel/Railway staging environment is established.
2. Verify that no existing candidate preview receives stateful requests or uses production origin credentials. Do not test with production cookies or order/customer routes.
3. Railway owner independently records production auto-deploy quarantine and confirms the running web, database, Redis, processor, volumes, source SHA, and migration state remain unchanged.
4. Run exact-source hosted component certification only after 1–3 and keep the release manifest's nine unresolved rows unchanged until their evidence is accepted.
5. A separate release owner reviews the exact code diff and expressly approves code-only main integration while both live deploy paths remain quarantined. Production release requires additional client, finance, legal, provider, data, and operations acceptance.
6. Before any branch retirement, list candidate refs one by one, calculate unique commits and open-PR ownership, create a durable archive and verify restore, then delete only specifically approved refs after safe main integration. Keep the legacy branch until its unique migration work has a reviewed disposition.
