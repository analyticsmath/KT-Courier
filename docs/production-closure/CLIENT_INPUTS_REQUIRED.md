# Client and operations input templates

Status: BLOCKED_EXTERNAL_INPUT. These are blank templates, not approved production values. Submit commercial inputs through the corresponding versioned admin surface. Submit bank details only through the protected cash-deposit configuration; never place them in Git, chat, screenshots or this file.

## Operational coverage (one record per region)

| Field | Approved input |
|---|---|
| Region name and existing ID | |
| Province | |
| Centre latitude / longitude | |
| Coverage radius km | |
| Maximum road route distance km | |
| Active courier service keys | |
| High-risk classification and surcharge authority | |
| Effective date | |
| Operations approver / evidence reference | |

Nationwide marketplace visibility is separate from courier serviceability. Supply real boundaries; an incomplete active/pricing-enabled region cannot authorize a quote.

## Parcel acceptance profiles (SMALL / MEDIUM / LARGE)

Parcel class and display name: ___
Maximum length / width / height in cm: ___
Maximum weight in kg: ___
Effective from / until: ___
Operations approval and evidence reference: ___

Review existing draft examples explicitly. Conflicting effective versions fail closed; they are not selected by sort order. Express-specific profiles remain inactive.

## Marketplace delivery matrix (one record per tariff band)

Size class (SMALL/MEDIUM/LARGE, or an expressly approved ANY class): ___
Distance band [minimum inclusive, maximum exclusive] km: ___
Province / region ID: ___
Base delivery subtotal in ZAR: ___
High-risk surcharge: ___
Minimum / maximum fee: ___
Store override ID and authorization: ___
Effective from / until: ___
Author / independent approver / approval reference: ___
Tax treatment: confirm the platform's versioned VAT configuration before activation: ___

Do not interpolate the client's broad range. Checkout currently permits an expressly authored ANY-size tariff when no trusted parcel classification exists; size-specific tariffs require classification completion.

## COD scope and operations

Approved store IDs: ___
Approved service keys: ___
Approved province / region IDs: ___
Maximum outstanding cash amount in ZAR: ___
Initial digital/driver split: confirm 50% / 50%: ___
Per-order override authority and unpaid-order restrictions: ___
Cash collection / custody / deposit procedure reference: ___
Secure bank-instructions version: ___
Settlement timing: ___
Policy author / separate finance approver / evidence reference: ___
Effective date: ___

Cash drafts do not activate themselves. Changed bank instructions invalidate the bound approval. FULL_COD and amended splits remain unavailable in production until a separately implemented, authorized amendment to the initial model.

## Commissions

For driver, platform, vendor/store and promoter separately:
Rule name / beneficiary: ___
Fixed amount versus percentage basis: ___
Exact value and currency / basis points: ___
Order subtotal versus total basis: ___
Store / service / programme scope: ___
Minimum / maximum: ___
Effective from / until: ___
Author / independent approver / evidence reference: ___

## Subscriptions

Plan name: ___
Monthly price / currency: ___
Benefits: ___
Usage limits: ___
Commission / fee relationship: ___
Provider billing authority: ___
Effective dates and reviewer: ___

## Promoter programme

Programme / rank names: ___
Rank thresholds: ___
Commission rules: ___
Qualification window: ___
Disqualification rules: ___
Payment timing: ___
Effective dates and independent approval: ___

## Advertising

Package name: ___
Price / currency: ___
Placement: ___
Duration: ___
Included channels: ___
Budget / billing rules: ___
Effective dates and reviewer: ___

## Legal and vendor assertions

Registered street/business address (only for required disclosure or provider use): ___
Required legal-counsel review and artifact reference: ___
Vendor stock and product-authenticity confirmation, store/catalog scope and date: ___

No public walk-in office is inferred from a registered address. Preserve the reviewed company contact profile.
