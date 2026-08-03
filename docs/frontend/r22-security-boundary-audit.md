# R22 security boundary audit

## Authentication, context, permissions, and ownership

Protected layouts use existing server guards: account/customer, store, driver, promoter, administration, payment customer/store, developer authenticated customer/store context, and applicant authentication. Developer is not a formal role; applicant is not inserted into the protected navigation registry. Admin navigation is server-filtered, while page/API permission checks remain authoritative. Applicant data queries resolve the signed-in applicant profile; developer snapshots filter by `ownerUserId`; role data remains in existing owner-scoped services.

Required runtime proof remains: log in as two accounts per role, use direct dynamic URLs, confirm a partial-permission admin sees only allowed workspaces/actions, confirm a read-only admin cannot mutate, and confirm Super Admin remains server-derived.

## Secrets, storage, and errors

Credential/webhook secrets are revealed only after the canonical action response and held in transient client state. They are not stored, placed in a URL/fragment, copied to a toast, projected into a list DTO, or logged by R22 code. Store catalog drafts no longer persist protected content in browser storage. The audited protected paths contain no `localStorage`, `sessionStorage`, or `document.cookie` usage.

Action errors are normalized to safe recoverable messages. Raw API `error`/`title`, provider payloads, stack traces, filesystem paths, tokens, headers, banking values, exact driver location, recruitment evidence, and credential/webhook source fields are not rendered by the audited R22 surfaces. The root error boundary no longer logs the raw caught error object.

## Client/server and production locks

Server components resolve session, permissions, ownership, financial projections, applicant/developer records, navigation and lock state. Client islands retain only existing interaction contracts and affirmative capability props; they do not receive permission registries, raw session values, Prisma models, credential hashes, signing secrets, raw webhook payloads, provider evidence, or ledger records.

Marketplace, provider, payout, subscription, promotion, advertising, promoter, developer-live, webhook/provider, notification, applicant contract, report/export and map/location locks are unchanged. The UI omits unsupported actions or states them as locked/unavailable.

## Unresolved runtime tests

Check rendered HTML/RSC/network output for credentials, browser storage, browser console, cache after logout/session expiry, dynamic owner references, forbidden paths, rate-limit/provider error messaging, and source-error boundaries using representative accounts. These require a user-run local environment and are not claimed complete here.
