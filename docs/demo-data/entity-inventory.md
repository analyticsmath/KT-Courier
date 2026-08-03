# KT Couriers — Full Demonstration Dataset Entity Inventory

**Seed Run ID:** `SEED-1785477770847`  
**Target Database:** `kt_courier_demo_full` (`localhost:5433`)  
**Historical Period:** `2025-07-01T00:00:00Z` to `2026-07-30T23:59:59Z` (~13 Months)

---

## 1. Complete Entity Count Summary

| Entity Model | Total Count | Target Threshold | Validation Status |
|---|---|---|---|
| `User` | **927** | ≥ 500 | ✅ PASSED |
| `Store` | **40** | ≥ 30 | ✅ PASSED |
| `DriverProfile` | **80** | ≥ 50 | ✅ PASSED |
| `PromoterProfile` | **50** | ≥ 30 | ✅ PASSED |
| `Vacancy` | **120** | ≥ 10 | ✅ PASSED |
| `VacancyApplication` | **2,400** | ≥ 200 | ✅ PASSED |
| `CatalogProduct` | **840** | ≥ 700 | ✅ PASSED |
| `CatalogProductVariant` | **1,260** | ≥ 1,000 | ✅ PASSED |
| `Order` (Courier Delivery) | **2,500** | ≥ 2,000 | ✅ PASSED |
| `MarketplaceOrder` | **1,600** | ≥ 1,000 | ✅ PASSED |
| `Notification` | **100** | ≥ 50 | ✅ PASSED |
| `ReportJob` | **6** | ≥ 5 | ✅ PASSED |
| `ReportExportArtifact` | **6** | ≥ 5 | ✅ PASSED |

---

## 2. Detailed Entity Breakdowns

### 2.1 User Accounts & Roles
- **Super Administrator** (1): `superadmin@demo.ktcouriers.test`
- **Operations Admins** (3): `ops.admin.01` – `03`
- **Finance Admins** (3): `finance.admin.01` – `03`
- **Support Admins** (3): `support.agent.01` – `03`
- **Recruitment Admins** (3): `recruiter.01` – `02`, `hiring.manager.01`
- **Developer & Catalog Admins** (4): `dev.admin.01` – `02`, `catalog.mod.01` – `02`
- **Customers** (500): 725 Active (incl. historical accounts), 5 Disabled, 10 Suspended
- **Store Owners** (40): Associated with 40 stores
- **Drivers** (80): 70 Active, 5 Pending Review, 5 Suspended
- **Promoters** (50): 46 Active, 4 Suspended

### 2.2 Store Breakdown
- **Active Stores** (34): Full product catalogs, inventory, published snapshots, and settled orders
- **Pending Stores** (4): `draft-merchant-store`, `pending-approval-bites`, `unpublished-corner-market`, `temporarily-closed-deli`
- **Suspended / Disabled Stores** (2): `suspended-tech-shop`, `inactive-pet-corner`

### 2.3 Driver Breakdown
- **Active / Available** (24): Ready for immediate dispatch assignment
- **Active / On Delivery** (46): Currently assigned to live simulated deliveries
- **Pending Review** (5): Onboarding review pipeline testing
- **Suspended** (5): Compliance enforcement testing

### 2.4 Courier & Marketplace Orders
- **Courier Deliveries (2,500 total)**:
  - `DELIVERED`: 2,000 (80%)
  - `IN_TRANSIT`: 125 (5%)
  - `PENDING`: 125 (5%)
  - `CANCELLED`: 125 (5%)
  - `FAILED`: 125 (5%)
- **Marketplace Store Orders (1,600 total)**:
  - `CONFIRMED` / `SETTLED`: 1,520 (95%)
  - `CANCELLED`: 80 (5%)

---

## 3. Financial & Accounting Verification

- **Platform Wallet**: `FOUNDATION_PLATFORM_WALLET` (ZAR) initialized with ledger accounts.
- **Double-Entry Balance Check**: `merchandiseSubtotal + deliveryFeeTotal = grandTotal` verified across all 1,600 marketplace checkouts and store orders.
- **Movement Evidence Check**: Every `CatalogInventoryLevel` on-hand quantity matches its corresponding `CatalogInventoryMovement` resulting on-hand evidence record.
