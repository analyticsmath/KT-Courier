# R21 governance and permission model

## Server authority

The administrative layout establishes only the `ADMIN`/`SUPER_ADMIN` context.
Every route retains its existing server page guard and every mutation keeps its
existing API/service permission enforcement. Navigation and visible controls
are convenience projections, not authorization.

| Surface | Read authority | R21 handling |
| --- | --- | --- |
| Employees | `employees.read` | Safe directory fields and recorded effective-permission count only. |
| Permission registry/defaults | `employees.permissions.manage` | Textual, keyboard-readable registry/default review. R21 does not change role defaults, key definitions, or override calculations. |
| Settings | `settings.read`; existing update authority remains in `SettingsManager` | Existing allowlisted setting projection and server confirmation. No secret/environment presentation. |
| Activity/security | `activity.read` and existing security authority | Bounded append-only activity projection; no session tokens, stack traces, raw IP evidence, or internal security rules. |
| Contact/email administration | existing route permissions and DTOs | Existing records and actions remain scoped to their canonical services; no artificial communication or recipient data expansion. |

## Decision controls

R21 distinguishes server-projected view, sensitive-read, initiate, review,
approve, complete, reverse, retry, configure and export authority. It does not
collapse these into a broad “admin can do everything” rule. Maker/checker
eligibility remains calculated by the canonical server implementation, and a
pending second-actor state is retained wherever the existing service returns it.

## Explicit exclusions

R21 does not modify permission keys, role defaults, user overrides, permission
APIs, auth/session infrastructure, security-event lifecycle, report job models,
export job models, storage/download behavior, or production locks. No report or
export route exists in the current admin tree, so no scaffold is presented as a
functional report/export feature.

## Review and sensitive fields

Role defaults and user overrides are shown only through the existing canonical
registry/effective-permission service; R21 does not recompute them in the
browser. Permission review is textual and keyboard-readable. Sensitive fields
remain server-selected: finance omits secrets and unmasked payout data,
recruitment omits restricted checks outside authority, developer views omit
credentials/payloads, notifications omit raw recipients, and settings omit
environment/secret values.

Security administration and audit records remain append-only canonical records.
Action controls require existing server confirmation; client components receive
no permission keys or bypass flag.
