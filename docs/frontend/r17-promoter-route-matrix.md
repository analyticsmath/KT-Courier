# R17 — Promoter Route Matrix

All routes require `PROMOTER` through the nested R17 layout. Route/API permissions and account ownership remain server authorities; this table records presentation behaviour, not a new permission system.

| Route | Purpose and data authority | Canonical action / lifecycle | Composition and mobile strategy | Privacy / financial / lock risk |
| --- | --- | --- | --- | --- |
| `/promoter` | Account, referral-code, qualification, wallet, inbox projections | Lifecycle only; referral-tools link | State first; four bounded metrics; five structured activity records | High privacy/finance; no action inferred |
| `/promoter/links` | Owned referral-code records | Code create/archive API, currently locked | Table → labelled records | Code is masked; no link/share/QR |
| `/promoter/referrals` | Owned attribution + safe qualification relation | Read-only attribution authority | Table → records | High privacy; no customer/order data |
| `/promoter/referrals/[reference]` | Owned attribution detail | Read-only | State and source-backed ordered timeline | High privacy; no evidence/fraud data |
| `/promoter/earnings` | Owned earning records and wallet projection | Read-only earning authority | Financial table → records | High financial; exact ZAR decimal text |
| `/promoter/earnings/[reference]` | Owned earning detail | Read-only | Financial facts and stored timeline | High financial; no journal/commission detail |
| `/promoter/wallet` | Promoter wallet projection | Read-only wallet authority | Compact balances | High financial; no ledger accounts |
| `/promoter/withdrawals` | Owned withdrawal requests and wallet projection | Withdrawal POST exists but production locked | History table → records | High financial; masked destination only |
| `/promoter/programs` | Active programme versions and own enrolment state | Enrolment POST exists but locked | Structured programme list | Terms/rates withheld |
| `/promoter/programs/[reference]` | Active programme detail | Enrolment remains locked | One-column factual record | No commercial internals |
| `/promoter/assets` | Approved/active marketing asset projection | Read-only | Structured list | No storage key/download URL |
| `/promoter/performance` | No safe R17 reporting DTO | None | Honest unavailable state | Vanity metrics withheld |
| `/promoter/compliance` | Account readiness fields | Compliance PATCH exists but locked | Readiness facts | Evidence/reviewer data withheld |
| `/promoter/profile` | Account-safe profile fields | Profile PATCH exists but locked | Factual record | Legal/tax/payout data withheld |
| `/promoter/notifications` | Owned notification inbox | Existing notification authority | Semantic structured inbox | No delivery/preference inference |
| `/promoter/support` | No support-ticket DTO | None | Honest unavailable state | No fictional contact path |
| `/promoter/disputes` | Owned dispute-safe projection | Create/evidence APIs exist but locked | Structured list | Statement/evidence withheld |
| `/promoter/disputes/[reference]` | Owned dispute-safe detail | Read-only while locked | One-column state record | Internal notes withheld |

No promoter route was renamed, merged, aliased, or added. There is no promoter route under `/account/*`; account routes remain customer-owned and untouched.
