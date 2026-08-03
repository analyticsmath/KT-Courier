# Phase 25 promoter and referral screen contract

This is a functional-source contract for Phase 30 Figma implementation, not a competing visual identity.

| Route | Permission | Required states/actions | Mobile difference |
| --- | --- | --- | --- |
| `/promoter` | `promoter_profile.read_own` | masked profile, readiness, funnel metrics, pending/payable/reversed earnings | stacked metrics and table alternatives |
| `/promoter/programs`, `/[reference]` | read/enrol | active/paused/ended programme, agreement gate, enrol action | disclosure remains before submit |
| `/promoter/links` | codes/channels manage own | create/archive confirmation, masked code, never reveal raw code after creation | copy control with accessible label |
| `/promoter/referrals`, `/[reference]` | referrals read own | masked references, attribution/qualification timeline, safe denial category | cards replace dense table |
| `/promoter/earnings`, `/wallet`, `/withdrawals` | own earning/wallet/withdrawal | held vs payable distinction, withdrawal eligibility and no guarantee of income | transaction-list alternative |
| `/promoter/compliance`, `/disputes`, `/assets` | respective own/assets permission | agreement/disclosure acknowledgement, safe dispute form, approved assets only | stepwise form flow |
| `/admin/promoters`, `/[reference]` | promoters read/review | lifecycle, agreement, enrolment, compliance, fraud and audit evidence; no manual earning | vertically grouped evidence |
| `/admin/promoter-programs*` | programme permissions | draft/review/approve/activate/pause/end, immutable active version | sticky state/action summary |
| `/admin/promoter-attributions`, `/qualifications`, `/earnings`, `/fraud*`, `/reconciliation*`, `/disputes*`, `/assets`, `/agreements` | corresponding read/manage permission | accessible filters, safe timelines, canonical retry only; no manual attribution/financial actions | filter drawer and labelled status chips |

All status must be textual as well as colour-coded. Forms need field errors, focus movement, confirmation for destructive archive action, keyboard-operable tables, and generic safe errors that do not enable code enumeration or expose customer data.
