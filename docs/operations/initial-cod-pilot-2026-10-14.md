# Initial COD pilot: researched starting ceiling, not an approved charge

The two priority client documents require the initial **50% digital / 50% driver cash** split, eligible approved stores/services/provinces, an editable **maximum COD amount**, driver collection/custody and independent bank reconciliation. They do not provide a numeric cap. The R100,000 shown in Updated Details is explicitly illustrative old dashboard data, not an approved courier cash exposure.

## Research-based operating proposal

Use an initial proposal of **R1,000 maximum cash outstanding for each COD order** (approximately R2,000 total on a 50/50 purchase). This is a conservative risk choice, not a South African law, industry standard, or client-provided contractual number. SAPS guidance recommends carrying as little cash as possible and choosing electronic payments where practicable: https://www.saps.gov.za/alert/carrycash_safely.php. SAPS has also warned of robberies targeting courier/delivery vehicles: https://www.saps.gov.za/newsroom/msspeechdetail.php?nid=49934.

This recommendation is **only an initial editable draft**; no bank account details, deposit timing or secondary approver can be inferred from public research. The same initial proposal is used per approved active store and active Economy/Standard/Express service in Gauteng. The pilot cannot operate outside verified coverage, with an unapproved driver, or without actual proof of collection and remittance.

## Technical launch behavior

On production pre-deploy, `initializeLaunchPaymentPolicies`:
- Creates an active global **DIGITAL** policy if no global policy has ever been authored. This is the document-selected full online payment baseline and does not authorize cash.
- Prepares INACTIVE per-store/per-service **DEPOSIT_PLUS_COD** policies at 50/50 with a R1,000 **cash**, not order, ceiling. Only active stores and active Gauteng services are included in **inactive** draft preparation. Their owners must be active and verified before any reviewed COD policy can be activated.
- Does not overwrite any previously authored policy scope, including custom rates, inactive versions or superceded policies. This is idempotent and audit logged.
- Does **not** approve or activate COD, fabricate bank instructions, send money or mark a delivery completed.

The existing admin payment-policies workflow allows editing the cash ceiling, deposit percentage and scope. A different authorized administrator must verify genuine secure bank instructions, settlement timing and the exact policy version before approving. `resolvePaymentBreakdown` enforces the persisted cash limit on the authoritative total and no policy exists solely by environment flag. Drivers collect only against verified digital deposit and their assigned in-transit delivery; deposits are independently reconciled through the ledger.

Do not label COD as externally live until at least one approved scoped cash policy, bank authority, approved recipient/driver and a real controlled delivery prove the entire custody process.
