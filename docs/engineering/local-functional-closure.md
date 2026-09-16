# Local Functional Connectivity Closure Record

## 1. Add-to-Cart Failure Chain & Root Cause Analysis

### 1.1 Root Cause Summary
- **Failing Layer**: Persistence Adapter (`lib/marketplace-checkout/prisma-cart-repository.ts` -> `saveCart` / `groupData`).
- **Prisma Exception**:
  ```text
  PrismaClientValidationError: 
  Invalid `db.marketplaceCart.update()` invocation in
  D:\KT-Courier\lib\marketplace-checkout\prisma-cart-repository.ts:31:32

  Argument `cart` is missing.
      at wn (D:\KT-Courier\node_modules\@prisma\client\runtime\library.js:29:1363)
      at Object.saveCart (D:\KT-Courier\lib\marketplace-checkout\prisma-cart-repository.ts:31:7)
      at commit (D:\KT-Courier\lib\marketplace-checkout\cart-mutation.service.ts:43:3)
      at addCartLine (D:\KT-Courier\lib\marketplace-checkout\cart-mutation.service.ts:64:12)
  ```
- **Mechanism**:
  In `prisma/schema.prisma`, `MarketplaceCartLine` declares:
  ```prisma
  model MarketplaceCartLine {
    ...
    cartId String
    storeGroupId String
    cart MarketplaceCart @relation(fields: [cartId], references: [id], onDelete: Restrict)
    storeGroup MarketplaceCartStoreGroup @relation(fields: [storeGroupId], references: [id], onDelete: Restrict)
    ...
  }
  ```
  In `lib/marketplace-checkout/prisma-cart-repository.ts`, `saveCart` invokes:
  ```typescript
  await db.marketplaceCart.update({
    where: { id: cart.id },
    data: {
      ...
      storeGroups: { create: groupData(cart) }
    }
  });
  ```
  Where `groupData(cart)` nested-creates `lines` under `storeGroups`.
  Because `MarketplaceCartLine` requires both `storeGroup` and `cart`, Prisma's nested create under `storeGroups` satisfies the `storeGroup` relation but leaves the `cart` relation unsatisfied (`Argument 'cart' is missing`), triggering a `PrismaClientValidationError`.
  The unhandled validation error bubbles out of `app/api/cart/lines/route.ts` into `marketplaceError()`, which falls back to returning HTTP 503 `{"error": "The cart or checkout request could not be completed."}`.

---

## 2. Reproduction Evidence Matrix

### 2.1 Test Execution Matrix

| Scenario | Persona | PDP URL | Product Ref | Variant Ref | Offer Ref | Store Ref | Qty | Modifiers | Cookie State | GET /api/cart Status | POST /api/cart/lines Status | Observed Error |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Simple Single-Offer | Guest | `/shop/products/prod-hass-avocados-4pk-CP-PROD-HASS-AVOCADOS-4PK` | `CP-PROD-HASS-AVOCADOS-4PK` | `CV-PROD-HASS-AVOCADOS-4PK` | `CO-JOZI-1-HASS-AVOCADOS-4PK` | `cmu057v3z02ohwj4x8paorfjq` | 1 | `[]` | `kt_marketplace_cart=y4D36...` | 200 OK | 503 | `The cart or checkout request could not be completed.` (PrismaClientValidationError) |
| Simple Single-Offer | Authenticated Customer (`sizwe.zulu1@example.co.za`) | `/shop/products/prod-hass-avocados-4pk-CP-PROD-HASS-AVOCADOS-4PK` | `CP-PROD-HASS-AVOCADOS-4PK` | `CV-PROD-HASS-AVOCADOS-4PK` | `CO-JOZI-1-HASS-AVOCADOS-4PK` | `cmu057v3z02ohwj4x8paorfjq` | 1 | `[]` | `kt_session=b3a5b...` | 200 OK | 503 | `The cart or checkout request could not be completed.` (PrismaClientValidationError) |
| Multi-Offer Product | Guest | `/shop/products/prod-salty-butter-500g-CP-PROD-SALTY-BUTTER-500G` | `CP-PROD-SALTY-BUTTER-500G` | `CV-PROD-SALTY-BUTTER-500G` | `CO-UBUN-16-SALTY-BUTTER-500G` | `cmu057rzu01z1wj4xdi7rert7` | 1 | `[]` | `kt_marketplace_cart=...` | 200 OK | 503 | `The cart or checkout request could not be completed.` (PrismaClientValidationError) |
| Multi-Offer Product (Offer 2) | Guest | `/shop/products/prod-salty-butter-500g-CP-PROD-SALTY-BUTTER-500G` | `CP-PROD-SALTY-BUTTER-500G` | `CV-PROD-SALTY-BUTTER-500G` | `CO-ROSE-8-SALTY-BUTTER-500G` | `cmu057ta00290wj4xl09y8tup` | 1 | `[]` | `kt_marketplace_cart=...` | 200 OK | 503 | `The cart or checkout request could not be completed.` (PrismaClientValidationError) |
| Quantity > 1 | Guest | `/shop/products/prod-hass-avocados-4pk-CP-PROD-HASS-AVOCADOS-4PK` | `CP-PROD-HASS-AVOCADOS-4PK` | `CV-PROD-HASS-AVOCADOS-4PK` | `CO-JOZI-1-HASS-AVOCADOS-4PK` | `cmu057v3z02ohwj4x8paorfjq` | 4 | `[]` | `kt_marketplace_cart=...` | 200 OK | 503 | `The cart or checkout request could not be completed.` (PrismaClientValidationError) |
| Multi-Variant Product | Guest | `/shop/products/...` | Variant B vs Variant A | Selection mismatch if visual patch does not update commercial identity | -- | -- | 1 | `[]` | `kt_marketplace_cart=...` | 200 OK | 503 | Pre-mutation schema error blocks execution; code review confirms visual variant patch desynchronization |
| Product with Modifiers | Guest | `/shop/products/...` | Modifier selection | Required modifiers | -- | -- | 1 | Selected options | `kt_marketplace_cart=...` | 200 OK | 503 | Pre-mutation schema error blocks execution |

### 2.2 Detailed Observed Request & Response Shapes

#### Guest Cart Initialization
- **Request**: `GET http://localhost:3000/api/cart`
- **Response Status**: `200 OK`
- **Set-Cookie**: `kt_marketplace_cart=y4D36qc3rqoxq4mB9yFD217QIOHN_XNikZKRRG8q-0c; Path=/; Expires=Wed, 14 Oct 2026 15:19:51 GMT; Max-Age=2592000; HttpOnly; SameSite=lax`
- **Response Body**:
  ```json
  {
    "cart": {
      "reference": "cart_3d5b696364ef47d8b7ebb80ffc255015",
      "status": "ACTIVE",
      "currency": "ZAR",
      "version": 1,
      "itemCount": 0,
      "totals": {
        "merchandiseSubtotal": "0.00",
        "modifierSubtotal": "0.00",
        "grandTotal": "0.00"
      },
      "storeGroups": []
    }
  }
  ```

#### Guest Add-to-Cart Mutation
- **Request**: `POST http://localhost:3000/api/cart/lines`
- **Headers**:
  ```http
  Content-Type: application/json
  Cookie: kt_marketplace_cart=y4D36qc3rqoxq4mB9yFD217QIOHN_XNikZKRRG8q-0c
  Origin: http://localhost:3000
  ```
- **Body**:
  ```json
  {
    "offerReference": "CO-JOZI-1-HASS-AVOCADOS-4PK",
    "variantReference": "CV-PROD-HASS-AVOCADOS-4PK",
    "quantity": 1,
    "modifiers": [],
    "operationId": "test-op-1",
    "requestHash": "hash-test",
    "cartVersion": 1
  }
  ```
- **Response Status**: `503 Service Unavailable`
- **Response Body**:
  ```json
  {
    "error": "The cart or checkout request could not be completed."
  }
  ```
- **Database Mutation State**: Unchanged (transaction rollback on validation failure).

---

## 3. High-Risk Architectural Defects Identified

1. **Prisma Cart Repository Nested Line Creation**:
   - `groupData()` in `lib/marketplace-checkout/prisma-cart-repository.ts` omits `cart: { connect: { id: cart.id } }` on each line created inside `storeGroups.lines.create`.
2. **Variant Page Commercial Identity Drift** (`[variantReference]/page.tsx`):
   - `variantAsProduct` visually patches title/media/price from the variant, but leaves `offerReference`, `variantReference`, and `productReference` pointing to the canonical product projection document instead of the selected variant's canonical offer.
3. **Multi-Seller Offer Selection Non-Interactive** (`OfferComparison.tsx`):
   - Offers are rendered purely as external links to store pages rather than interactive "Select offer" / "Buy from this store" actions that update the active purchase selection on the PDP.
4. **Inconsistent Store Route Families in Cart** (`CartExperience.tsx`):
   - Line 320 uses hardcoded `/store/${group.storeSlug}` rather than the canonical `marketplaceStoreHref(group.storeSlug)` (`/shop/stores/${storeSlug}`).
5. **Checkout State Machine Versioning & Gates**:
   - State transitions and local payment orchestration requires deterministic local provider support when external payment providers (e.g. live Paystack) are disabled.
