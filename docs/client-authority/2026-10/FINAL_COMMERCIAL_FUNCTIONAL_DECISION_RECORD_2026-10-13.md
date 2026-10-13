# KT Couriers — final client-authority reconciliation
**Review date:** 13 October 2026  
**Source:** Seven distinct client DOCX document bodies, comprising the two newly supplied documents and the five additional unique sources already preserved by the project. Duplicate copies of the two new uploads have identical SHA-256 hashes and add no new instructions.  
**Purpose:** Concrete application configuration decisions, not a claim of legal/financial acceptance.

## Precedence and evidence
1. Explicit owner instructions and the more specific final statement take precedence over conflicting earlier examples.
2. `KT COURIERS — WEBSITE & SYSTEM CHANGES(1).docx`: latest user-role, public quote, vendor, permissions and UX authority; SHA-256 `13e99cd7c71e4922...`.
3. `KT COURIERS — Delivery and Access(1).docx`: service, COD, region, commission and office-status authority; SHA-256 `f37d9903734488e4...`.
4. `KT_Couriers_Updated Details..docx`: example size measurements, Express fixed size components, business identity, configurable catalog/advertising/driver fields.
5. `KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx`: customer shipping commitments and active-service limitations.
6. `KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx`: contract and restricted goods.
7. `KT COURIERS (PTY) LTD – PRIVACY POLICY.docx`: POPIA privacy, location, banking, retention and subject rights.
8. `KT COURIERS (PTY) LTD – ABOUT US.docx`: brand, service mission and marketing descriptions.
9. Source corpus and signed-off policy publication text: `docs/client-authority/2026-10/reviewed-client-documents.json`, `public-policies.json`; repository integration review `README.md`.

## Implementable commercial baseline

| Scope | Documentary authority | Implementation decision | Release restriction |
|---|---|---|---|
| Economy | Small R89; Medium R129; Large R179; target 3–4 business days | Versioned/admin-editable size tariff; exclude special handling and high-risk fees until defined | Quote only with approved active parcel profiles, configured coverage and verified routing |
| Standard | Small R129; Medium R179; Large R249 | Target **1–2 business days**; this expressly supersedes older 1–3 and 2–3 statements | No delivery guarantee beyond confirmed order promise |
| Express | R5.50/km; previously expressly clarified plus fixed Small R5.50 / Medium R8.50 / Large R13.00 | Versioned distance formula with positive size component; independent vehicle/distance/route validation | Same-day depends on capacity and enabled zones; no unconditional customer guarantee |
| Scheduled | Later pickup/delivery date or window, using a selected service | Booking qualifier, **not** separate speed/tariff; independent scheduled charge forbidden | User must have an available approved delivery service |
| Marketplace delivery | R90–R170 described as range depending on size, distance, area/high risk | Treat as *illustrative*, not a validated fee matrix | Unconfigured delivery fee cannot be silently guessed |
| Parcel examples | Small 30×20×10 cm/5 kg; Medium 50×40×30 cm/15 kg; Large 70×50×50 cm/30 kg | Record editable **DRAFT** profiles with canonical SMALL/MEDIUM/LARGE identifiers | Never auto-activate example limits. Actual thresholds require operations sign-off |
| COD | Initial 50% digital + 50% driver cash | Configurable store, service, region, order, limit and split; full custody and reconciliation | Disabled unless named store/service/coverage/limits and payment account are approved |
| Driver / KT split | 70% / 30% examples | Configurable commission schedule only | No production settlement activation from example figures |
| Store/vendor commission | 8–10% example range | Per-store/module/versioned commission; optional plan terms | No automatic vendor charge from examples |
| Promoter/KT50 | Tier/rank and incentive examples (Updated Details) | Track only according to approved programme, with independently configurable ranks | No referral registration fees, MLM-style payouts or subscriptions without express commercial/legal approval |
| Ad packages/subscriptions | Prices and bundles shown as examples in Updated Details and illustration | Admin-editable DRAFT package definitions | Do not activate priced plans absent approved service terms and launch schedule |
| Seasonal surcharge | Optional percentage and customer notice | Versioned/admin-controlled percentage with visible customer explanation | Not enabled by default; no invented amount |
| Heavy truck/overnight/relocation | Future pricing expressly deferred | Request custom review/quote rather than guessed tariff | No instant consumer pricing without effective rules |

## Coverage and product-visibility separation
- Stores/products may be browsed across South Africa by default. A store's optional provincial restriction is distinct from KT's delivery serviceability.
- Current delivery operations focus on Johannesburg, Pretoria and surrounding Gauteng areas, but **no polygon, set of approved postal codes, service hours, cutoffs, vehicle capacity or high-risk boundary has been supplied**.
- The quote/checkout must evaluate active approved origin/destination zones, service enablement, parcel size, routing and current capacity rather than treat a province label as proof of availability. Expansion must remain configurable.
- If an operational eligibility decision cannot be made, fail closed with an actionable unavailable/quote-request response; do not calculate or charge unapproved rates.

## Business identity and legal policy
- Company: KT Couriers (Pty) Ltd. Registration 2024/475266/07; VAT number 4120307386, as supplied by client (not independently registered/tax-verified).
- Communications: info@ktcouriers.com business email, support@ktcouriers.com support email; telephone 067 815 5245 / 075 019 2265.
- **info@ktcouriers.com is an email address, not a physical street address.** No walk-in office is claimed. A compliant registered/business street address is still required if shown on legal/invoice surfaces; never invent it.
- Reviewed shipping, privacy, terms and refund texts are preserved with version/hash. Existing adjustments to COD/upfront-payment and statutory refunds are source-reconciled, but no legal counsel sign-off is implied.
- Show regulated pharmacy/high-risk restrictions, vendor identity obligations, privacy minimization and lawful access in all affected workflows.

## Functionality the documents require
- Guest parcel quotes (pickup, drop-off, size, weight, selected speed, price) before authentication; booking, payment, private history behind auth.
- Customer profile/avatar, saved addresses, reviews, chats, wallets, notices, orders.
- Vendor business onboarding, products/variants/stock, multiple images, publication review, campaigns, coupons, banners, expenses, employee invitations and granular rights.
- Driver KYC, separate vehicle approval, photos/documents, GPS and delivery proof, customer/admin chat, cash custody, deposit balances and auditable settlement.
- Superuser has audited, purpose-scoped access; impersonation or unrestricted finance mutation must not be inferred from support access.
- Media access control; private ID/licence/payment documents never placed on public asset URLs.
- Business and marketing modules must be configuration-driven and permissions-bound, not hardcoded percentages and fees.

## Engineering corrections prompted by this review
1. Client example parcel drafts were being stored as `CLIENT_SMALL`, `CLIENT_MEDIUM`, `CLIENT_LARGE`, while the existing admin editor lists and accepts `SMALL`, `MEDIUM`, `LARGE`. Initializer now uses canonical keys with status `DRAFT` and never overwrites existing operator versions. Earlier legacy drafts are left intact, not deleted.
2. The legacy commercial taxonomy had `SCHEDULED_DELIVERY` as a standalone priceable service primitive. The pricing assertion now refuses any independently chargeable Scheduled rule: an approved selected delivery service supplies the price.
3. These are **source-only corrections**. They do not run a live initializer, activate rates, edit production rows or authorize customer collection.

## Explicitly missing external evidence
- Actual operational dimensions/weights approved as binding and any multi-item packing classification rules.
- Exact postcode/polygon coverage, operating calendar/cutoffs, distance rounding, high-risk delivery policy and effective fee schedule.
- COD maximum amounts and eligibility per store, customer, service and region; signed split/escrow/deposit/shortage and returns responsibilities.
- Commission fee basis, effective VAT/tax treatment, merchant/bank account verifications, settlement and refund permissions.
- Registered/business street address if legally required; verified provider senders/templates; authorized media retention.
- Independent customer/vendor/driver human acceptance; physical mobile camera/GPS and assisted-technology review; independent test-exclusion review.
- Read-only protected-production-data audit and recoverable backup/restore proof; exact-SHA cutover/rollback approvals and safe Railway staged-patch disposition.

## Launch decision
**NO_GO remains the correct live-payment and production-cutover status.** Software completeness can be advanced without staging, using isolated existing test infrastructure and direct `main` source control. No person, credential, geographic boundary, legal registration location, financial percentage or provider approval may be invented from sample text.

The source-of-truth launch gate manifest is `docs/production-closure/engineering-gates.json`; update individual statuses only after authentic, scope-bound evidence and reviewer approvals exist.
