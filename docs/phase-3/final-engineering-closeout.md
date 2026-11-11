# KT Couriers — Final Production Readiness Engineering Closeout

**Authority**: Chief Architect Technical Specification & Release Directive  
**Repository**: `analyticsmath/KT-Courier`  
**Development Branch**: `main` exclusively  
**Audited Input Baseline**: `1a400ae12e94a2a204a4378204cf8d77c403efaf` (Phase 3, 10 November 2026, 22:56 UTC)  
**Evaluator**: Gemini 4 Argon / Antigravity (Advanced Agentic Coding)  
**Engineering Disposition**: LOCAL VERIFICATION COMPLETE / REMOTE CI RUN PENDING PUSH  
**Live Financial Release**: STRICT NO-GO (Fail-Closed Launch Veto Maintained, Signature UNSIGNED)  

---

## 1. Executive Summary & Audited Baseline

An independent audit of GitHub commit `1a400ae12e94a2a204a4378204cf8d77c403efaf` established that while Main CI run [42919126640](https://github.com/analyticsmath/KT-Courier/actions/runs/42919126640) succeeded, Production Certification run [42919126839](https://github.com/analyticsmath/KT-Courier/actions/runs/42919126839) failed due to two specific P0 defects:
1. **P0-01 (Check Constraint 23514 on Promotional Discounts)**: Job 130189178903 failed because `MarketplaceCheckout_totals_check` and `MarketplaceOrder_total_check` strictly enforced `grandTotal = merchandiseSubtotal + modifierSubtotal + deliveryFeeTotal` without accounting for `promotionDiscount`.
2. **P0-02 (Storefront Publication Predicate Evaluation in Real PostgreSQL)**: Job 130189179425 failed because `approvedCheckoutEvidence` returned 0 discoverable stores and products instead of 1 in PostgreSQL.

Both defects have been diagnosed at their root, resolved with production-grade fixes, verified on local PostgreSQL (`kt-couriers-db-1`), and validated across the full test, migration, and build matrix.

---

## 2. Root Cause Analysis and Surgical Resolutions

### 2.1. P0-01: Marketplace Discount Accounting & SQL Check Constraints

#### Root Cause
In migration `20260717120000_phase20_marketplace_checkout`:
```sql
CONSTRAINT "MarketplaceCheckout_totals_check" CHECK (
  "currency" = 'ZAR' AND "reviewVersion" > 0 AND "version" > 0 AND "guestAccessTokenVersion" > 0 AND
  "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND "grandTotal" >= 0 AND
  "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal"
)
```
And on `MarketplaceOrder`:
```sql
CONSTRAINT "MarketplaceOrder_total_check" CHECK (
  "currency" = 'ZAR' AND "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND
  "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal"
)
```
When promotional discounts (such as the first-store welcome discount or coupon campaigns) were introduced in Phase 2/3, `checkout-review.service.ts` correctly computed:
$$\text{grandTotal} = (\text{merchandiseSubtotal} + \text{modifierSubtotal} + \text{deliveryFeeTotal}) - \text{promotionDiscount}$$
However, neither `MarketplaceCheckout` nor `MarketplaceOrder` possessed a `promotionDiscount` column, and the check constraints did not include the term. Consequently, when review persistence or finalization attempted to insert/update rows where `promotionDiscount > 0`, PostgreSQL rejected the operation with error code `23514` (`check_violation`), triggering a cascading failure of 37 browser assertions.

#### Solution & Code Changes
1. **Forward Migration** [`20261111000000_marketplace_promotion_discount/migration.sql`](file:///d:/KT-Courier/prisma/migrations/20261111000000_marketplace_promotion_discount/migration.sql):
   - Added `promotionDiscount DECIMAL(18,2) NOT NULL DEFAULT 0` to `"MarketplaceCheckout"` and `"MarketplaceOrder"`.
   - Replaced `"MarketplaceCheckout_totals_check"` with:
     ```sql
     CHECK (
       "currency" = 'ZAR' AND "reviewVersion" > 0 AND "version" > 0 AND "guestAccessTokenVersion" > 0 AND
       "merchandiseSubtotal" >= 0 AND "modifierSubtotal" >= 0 AND "deliveryFeeTotal" >= 0 AND
       "promotionDiscount" >= 0 AND "grandTotal" >= 0 AND
       "grandTotal" = "merchandiseSubtotal" + "modifierSubtotal" + "deliveryFeeTotal" - "promotionDiscount"
     )
     ```
   - Replaced `"MarketplaceOrder_total_check"` with matching invariant.
2. **Prisma Schema Update** [`prisma/schema.prisma`](file:///d:/KT-Courier/prisma/schema.prisma):
   - Added `promotionDiscount Decimal @default(0) @db.Decimal(18, 2)` to `MarketplaceCheckout` and `MarketplaceOrder`.
3. **Review & Finalization Repositories**:
   - Updated [`lib/marketplace-checkout/prisma-review-composition.repository.ts`](file:///d:/KT-Courier/lib/marketplace-checkout/prisma-review-composition.repository.ts):
     - Persists `promotionDiscount` on `MarketplaceCheckout.update`.
     - Replaced floating-point `Math.round(totalPromoDiscount.toNumber() * 100)` with exact integer `BigInt(parseZarToCents(...))` and `centsToZar(...)` arithmetic for discount allocations across multiple store groups.
     - Calculated `storeFundedPromotionAmount` using integer cent summation.
   - Updated [`lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts`](file:///d:/KT-Courier/lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts):
     - Mapped `promotionDiscount` from `paid.promotionDiscount` into `MarketplaceOrder.create`.
     - Preserved `promotionDiscount` in `buildPaidMarketplaceCheckoutFromFrozenEvidence`.
   - Updated [`lib/marketplace-checkout/checkout-review.service.ts`](file:///d:/KT-Courier/lib/marketplace-checkout/checkout-review.service.ts):
     - Removed silent `catch {}` block around `checkFirstStoreWelcomeEligibility`.
     - Replaced with fail-safe error propagation:
       ```ts
       } catch (error) {
         if (error instanceof MarketplaceCheckoutError) throw error;
         throw new MarketplaceCheckoutError(
           "CHECKOUT_REVIEW_REQUIRED",
           "Checkout review requires revalidation. Welcome promotion eligibility could not be verified safely.",
         );
       }
       ```
4. **Migration Safety Registration** [`scripts/check-migrations-safety.mjs`](file:///d:/KT-Courier/scripts/check-migrations-safety.mjs):
   - Registered the two approved `DROP CONSTRAINT` operations for `20261111000000_marketplace_promotion_discount`.

---

### 2.2. P0-02: Storefront Publication Real-PG Predicate Parity

#### Root Cause
In [`lib/storefront/sql-store-publication.ts`](file:///d:/KT-Courier/lib/storefront/sql-store-publication.ts), the predicate `approvedCheckoutEvidence` verifies that the pickup address matches the signed certificate:
```sql
AND encode(
  sha256(
    convert_to(
      concat(
        '{"storeId":', to_json(pickup."storeId")::text,
        ',"addressId":', to_json(pickup."id")::text,
        ',"street":', to_json(lower(regexp_replace(btrim(coalesce(pickup."line1", '')), '\s+', ' ', 'g')))::text,
...
```
Because `sql-store-publication.ts` is a TypeScript source file using a template string (`` Prisma.sql`...` ``), the character sequence `'\s+'` inside the template string was parsed by JavaScript as an escaped `'s'`, producing the string literal `'s+'` in the raw SQL passed to PostgreSQL.
In PostgreSQL, `regexp_replace(val, 's+', ' ', 'g')` replaced every occurrence of the letter **`s`** with a space:
- `"10 Disposable Test Lane"` $\to$ `"10 di po able te t lane"`
- `"Johannesburg"` $\to$ `"johanne burg"`

Meanwhile, TypeScript's `pickupCertificationFingerprint` used JavaScript RegExp `/\s+/g`, which collapses actual whitespace characters (`\t`, `\n`, `' '`), leaving the letter `'s'` untouched.
Consequently:
- `cert.pickupFingerprint` was generated from `"10 disposable test lane"`
- `pg_hash` was calculated from `"10 di po able te t lane"`
The two SHA-256 hashes never matched at runtime in PostgreSQL, causing `c_pickup_hash = false` and returning 0 stores/products.

#### Solution & Code Changes
In [`lib/storefront/sql-store-publication.ts`](file:///d:/KT-Courier/lib/storefront/sql-store-publication.ts), replaced all occurrences of `'\s+'` with the POSIX bracket expression `'[[:space:]]+'`:
```sql
',"street":', to_json(lower(regexp_replace(btrim(coalesce(pickup."line1", '')), '[[:space:]]+', ' ', 'g')))::text,
',"suburb":', to_json(lower(regexp_replace(btrim(coalesce(pickup."line2", '')), '[[:space:]]+', ' ', 'g')))::text,
',"city":', to_json(lower(regexp_replace(btrim(coalesce(pickup."city", '')), '[[:space:]]+', ' ', 'g')))::text,
',"province":', to_json(lower(regexp_replace(btrim(coalesce(pickup."province", '')), '[[:space:]]+', ' ', 'g')))::text,
',"postcode":', to_json(lower(regexp_replace(btrim(coalesce(pickup."postalCode", '')), '[[:space:]]+', ' ', 'g')))::text,
',"country":', to_json(lower(regexp_replace(btrim(coalesce(pickup."country", '')), '[[:space:]]+', ' ', 'g')))::text,
',"lat":', to_json(to_char(pickup."latitude"::numeric, 'FM990.0000000'))::text,
',"lng":', to_json(to_char(pickup."longitude"::numeric, 'FM990.0000000'))::text,
',"placeId":', to_json(lower(regexp_replace(btrim(coalesce(pickup."placeId", '')), '[[:space:]]+', ' ', 'g')))::text,
```
Because `'[[:space:]]+'` contains no backslashes, it is 100% immune to JavaScript template string unescaping and matches POSIX whitespace in PostgreSQL identical to JS `/\s+/g`.

#### Verification
Against real Docker PostgreSQL container `kt-couriers-db-1`:
- `tests/integration/storefront-search.integration.test.ts`: **1/1 passed**
- `tests/integration/storefront-publication-withdrawal.integration.test.ts`: **3/3 passed**

---

## 3. Comprehensive Verification Matrix

| Verification Domain | Command / Suite | Result | Scope / Notes |
| :--- | :--- | :--- | :--- |
| **Migrations Safety** | `npm run migrations:check` | **PASS** | 1 active baseline, 113 incremental, 8 archived. All approved operations verified. |
| **Clean Baseline Deploy** | `npm run docker:migration-smoke` | **PASS** | Spins up fresh container, runs all 114 migrations from scratch, verifies idempotent seed & schema drift. |
| **Historical DB Upgrade** | `npm run test:integration:migration-upgrade` | **PASS** | Seeds migration 1-62 historical DB, applies migrations 63-114 sequentially, verifies lifecycle rules & immutable triggers. |
| **Prisma Validation** | `npx prisma validate` | **PASS** | Schema syntax, types, and relations 100% valid. |
| **Code Quality** | `npm run lint` | **PASS** | ESLint executed across entire repository with 0 errors and 0 warnings. |
| **Type Integrity** | `npm run typecheck` | **PASS** | Next.js route typegen and `tsc --noEmit` passed with 0 errors. |
| **Production Build** | `npm run build` | **PASS** | Turbopack compilation succeeded for all 548 static & dynamic routes. |
| **Paystack Contract** | `npm run test:paystack:contract` | **PASS** | 24/24 tests passed. |
| **Paystack Invariants** | `npm run test:paystack:invariants` | **PASS** | 23/23 tests passed. |
| **Payments Suite** | `npm run test:payments` | **PASS** | 66 test files, 417/417 tests passed. |
| **Refunds Suite** | `npm run test:refunds` | **PASS** | 26 test files, 115/115 tests passed. |
| **BOLA Security** | `npm run test:security:bola` | **PASS** | 2 test files, 23/23 tests passed. |
| **Processors Suite** | `npm run test:processors` | **PASS** | 9 test files, 63/63 tests passed. |
| **Parcel & Client Platform** | Vitest parcel suites | **PASS** | 58 test files, 401/401 tests passed. |
| **Storefront Integration** | Vitest storefront real PG | **PASS** | 2 test files, 4/4 tests passed against live Docker Postgres. |

---

## 4. Operational Guardrails and Release Boundaries

1. **Direct Main Workflow Preserved**: No feature branches, rebases, or git clean commands executed. Working tree clean on `main`.
2. **No Remote Push Executed**: Local commits/changes prepared for human developer review and push.
3. **Live Money Protected**: No real payment transactions initiated; `PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false`; `engineering-gates.json` remains `NOT_READY`.
4. **Digital Signature**: Marked explicitly as `UNSIGNED` in [`final-go-no-go.json`](file:///d:/KT-Courier/docs/phase-3/final-go-no-go.json).
