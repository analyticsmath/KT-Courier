# KT Couriers — 15-Step Client Demonstration Guide
**Authoritative Operational Walkthrough for Staging & Client Demonstration**

This document provides an end-to-end, reproducible 15-step script for demonstrating the full KT Couriers platform to stakeholders, investors, and clients. Every step uses verified, real-world data seeded into the isolated demonstration database.

---

## Shared Demonstration Credentials

All accounts in the demo universe share a uniform local demonstration password:
* **Default Password:** `password123` (or the value set in `KT_DEMO_ACCOUNT_PASSWORD`)

| Persona | Email | Password | Primary Destination | Scenario Context |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@ktcouriers.local` | `password123` | `/admin/dashboard` | Full platform authority, financial ledger, system settings |
| **Operations Admin** | `admin@ktcouriers.local` | `password123` | `/admin/operations` | Fleet dispatch, active assignments, regional route control |
| **Merchant (Groceries)** | `store.ubuntu-fresh-market@ktcouriers.local` | `password123` | `/store/dashboard` | Johannesburg grocer with active offers and order intake |
| **Merchant (Electronics)** | `store.circuit-house-electronics@ktcouriers.local` | `password123` | `/store/dashboard` | Pretoria electronics merchant with high-ticket inventory |
| **Merchant (Bakery)** | `store.kloof-street-bakery@ktcouriers.local` | `password123` | `/store/dashboard` | Cape Town artisanal bakery with same-day baked goods |
| **Driver (Car)** | `driver.lerato.adams1@ktcouriers.local` | `password123` | `/driver/dashboard` | Active driver (DRV-001) in Johannesburg with Toyota Quest |
| **Driver (Motorcycle)**| `driver.kagiso.khumalo2@ktcouriers.local` | `password123` | `/driver/dashboard` | Urban express driver (DRV-002) operating Honda Ace 125 |
| **Customer (Primary)** | `sizwe.zulu1@example.co.za` | `password123` | `/customer/dashboard` | Frequent shopper in Parkhurst, JHB with rich order history |
| **Customer (Secondary)**| `tanya.chetty2@example.co.za` | `password123` | `/customer/dashboard` | Menlyn, Pretoria resident with pharmacy & grocery deliveries |
| **Promoter** | `promoter.themba.du.plessis1@ktcouriers.local` | `password123` | `/promoter/dashboard` | Active affiliate with code `JHBVIBES` and verified commissions |

---

## 15-Step Client Demonstration Script

### Step 1: Universe Health & Automated Connectivity Check
1. Open your terminal in the project directory.
2. Execute the automated connectivity verifier:
   ```bash
   npm run demo:verify:connectivity
   ```
3. Observe **0 failures** across all 180 canonical products, 20 stores, 32 categories, and 640 catalog media assets.
4. Execute the database invariant auditor:
   ```bash
   npm run demo:verify
   ```
5. Confirm that the 6.5-month temporal timeline (March 2026 to September 2026), double-entry ledger balance, and all 600 orders (180 courier + 420 marketplace) are valid.

---

### Step 2: Public Marketplace Homepage Experience
1. Open your browser and navigate to: `http://localhost:3000/shop`
2. **Observe:**
   * Dynamic Hero Banner advertising same-day delivery across Gauteng, Western Cape, and KwaZulu-Natal.
   * Curated category pills with high-resolution visual cards.
   * Product discovery grid displaying canonical products with real South African ZAR pricing, brand tags, and in-stock statuses.
   * Zero broken images; all assets are delivered from the local media engine (`/api/catalog/media/...`).

---

### Step 3: Hierarchical Category Discovery
1. From the navigation header or directly, go to: `http://localhost:3000/shop/categories`
2. Click on **Groceries and Fresh Produce** (`/shop/categories/groceries`).
3. Click into a subcategory, e.g., **Fresh Produce** or **Dairy & Eggs**.
4. **Observe:**
   * Category banner rendered at crisp 1600x1000 resolution.
   * Accurate breadcrumbs allowing quick navigation back to parent categories.
   * Filter sidebar displaying available brands, pricing bands, and merchant locations.

---

### Step 4: Merchant Store Directory
1. Navigate to: `http://localhost:3000/shop/stores`
2. **Observe:**
   * Grid of verified South African merchants grouped by region (Johannesburg, Pretoria, Cape Town, Durban).
   * Verified merchant badges, logos, and city location tags.
   * Stores include **Ubuntu Fresh Market**, **Rosebank Pantry and Deli**, **Circuit House Electronics**, **Kloof Street Bakery and Roastery**, and **Protea Casualwear**.

---

### Step 5: Storefront Deep Dive (Ubuntu Fresh Market)
1. Click on **Ubuntu Fresh Market** or visit: `http://localhost:3000/shop/stores/ubuntu-fresh-market`
2. **Observe:**
   * Official merchant hero banner and brand logo.
   * Full store dispatch address: `284 Fox Street, Maboneng, Johannesburg`.
   * Curated merchant catalog containing in-season produce, farm dairy, fresh flowers, and pet nutrition.
   * Immediate dispatch SLA indicator: *"Same-day dispatch available"*.

---

### Step 6: Multi-Vendor Comparison Journey
1. Navigate to a popular multi-vendor canonical product on `/shop`, e.g., fresh milk or rooibos tea:
   `http://localhost:3000/shop/products/clover-fresh-full-cream-milk-2l-CP-PROD-MILK-2L`
2. **Observe:**
   * The multi-vendor comparison drawer/table beneath the primary product section.
   * Notice multiple stores offering the identical canonical item (e.g., Ubuntu Fresh Market at R34.50 vs. Rosebank Pantry at R36.00).
   * Each offer links directly to the specific store's checkout line with transparent delivery fees.

---

### Step 7: Product Detail Page & 3-Angle Visual Gallery
1. Open any product detail page, for example:
   `http://localhost:3000/shop/products/fresh-hass-avocados-4pk-CP-PROD-AVOCADOS`
2. **Observe:**
   * **Multi-Image Gallery:** Click through all 3 distinct views (View 1: Hero Presentation, View 2: Detail & Texture, View 3: Packaging & Contents).
   * Notice that the browser URL accurately tracks canonical routes (`/shop/products/[slug]-[ref]`).
   * Condition indicator (*"Brand New"*), Stock indicator (*"In Stock"*), and Dispatch badge (*"Courier Delivery"*).

---

### Step 8: Unified Cart Experience
1. Click **Add to Cart** on the current product.
2. Navigate back to `/shop` and add an item from a second merchant (e.g. from *Circuit House Electronics*).
3. Click the Cart icon or visit: `http://localhost:3000/cart`
4. **Observe:**
   * Multi-store checkout grouping: Cart groups items cleanly by merchant.
   * Subtotal per merchant, transparent logistics fee allocation (R45.00 flat dispatch), and Grand Total in ZAR.

---

### Step 9: Transparent Checkout & Legal Compliance
1. From the cart, click **Proceed to Checkout** (`/checkout`).
2. **Observe:**
   * Delivery address selector automatically loaded for customer.
   * **Legal Compliance Check:** Scroll to the legal consent section. Click **Terms of Service** (`/terms`) and **Privacy Policy** (`/privacy-policy`).
   * Verify that both links open clean, fully rendered legal disclosure pages without any 404 errors.
   * Payment method selection showing Paystack/PayFast digital options with sandbox validation.

---

### Step 10: Customer Experience & Order History
1. Log in as primary customer:
   * **Email:** `sizwe.zulu1@example.co.za`
   * **Password:** `password123`
2. Navigate to: `http://localhost:3000/customer/dashboard`
3. **Observe:**
   * Active and completed orders table.
   * Click on any historical order (e.g. `MKT-2026-000100` or `KT-2026-000050`).
   * Inspect item breakdown, live delivery tracking status (Delivered), assigned driver details, and digital proof-of-delivery (POD).

---

### Step 11: Merchant Storefront & Orders Portal
1. Log out and log in as store merchant:
   * **Email:** `store.ubuntu-fresh-market@ktcouriers.local`
   * **Password:** `password123`
2. Navigate to: `http://localhost:3000/store/dashboard`
3. **Observe:**
   * Store revenue metrics, total orders fulfilled, and average order value.
   * Active catalog management tab showing all published offers (`CO-...`) and price versions (`CPR-...`).
   * Incoming order queue with real-time status transitions (Pending Store Review, Settled).

---

### Step 12: Driver Fleet Operations App
1. Log out and log in as active driver:
   * **Email:** `driver.lerato.adams1@ktcouriers.local`
   * **Password:** `password123`
2. Navigate to: `http://localhost:3000/driver/dashboard`
3. **Observe:**
   * Driver ID: `DRV-001`, Active Vehicle: `Toyota Corolla Quest 1.6 (GP 811-115)`.
   * Onboarding Status: **APPROVED**, Availability: **AVAILABLE**.
   * Active dispatch queue, completed trips, earnings ledger, and GPS dispatch waypoint previews in Johannesburg.

---

### Step 13: Operations & Dispatch Admin Portal
1. Log out and log in as Operations Administrator:
   * **Email:** `admin@ktcouriers.local`
   * **Password:** `password123`
2. Navigate to: `http://localhost:3000/admin/operations`
3. **Observe:**
   * Real-time dispatch hub covering Johannesburg, Pretoria, Midrand, Cape Town, and Durban.
   * Active fleet roster showing vehicle types (Motorcycles, Cars, Vans) and availability states.
   * Emergency re-assignment controls and SLA delivery performance metrics.

---

### Step 14: Platform Super Admin & Financial Double-Entry Ledger
1. Log out and log in as Super Administrator:
   * **Email:** `superadmin@ktcouriers.local`
   * **Password:** `password123`
2. Navigate to: `http://localhost:3000/admin/dashboard` and `/admin/finance`
3. **Observe:**
   * Platform-wide GMV, net revenue, active merchant counts (16 active, 4 managed), and total orders (600).
   * **Financial Ledger:** View double-entry ledger journals (`JNL-...`).
   * Observe balanced debits and credits across `PLATFORM-CASH-CLEARING-ZAR` and `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR`.
   * Strict Phase 12 proof: Each payment has linked `PaymentAttempt`, `PaymentWebhookEvent`, and journal reference.

---

### Step 15: Affiliate Promoter Marketing Dashboard
1. Log out and log in as affiliate promoter:
   * **Email:** `promoter.themba.du.plessis1@ktcouriers.local`
   * **Password:** `password123`
2. Navigate to: `http://localhost:3000/promoter/dashboard`
3. **Observe:**
   * Referral Code: `JHBVIBES`.
   * Attributed orders, conversion rates, and gross commissions earned.
   * Transparent payout requests and wallet balance ledger.

---

## Conclusion & Demo Teardown

To reset the demonstration universe back to its pristine initial state at any time:
```bash
npm run demo:reset
npm run demo:seed
npm run demo:verify
npm run demo:verify:connectivity
```
All commands execute deterministically using the fixed seed `20260912`.
