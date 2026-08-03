# KT Couriers Phase R12 — Protected Application Discovery & System Architecture

> **Audit Context**: Phase R12 — Discovery & System Architecture for Protected Applications  
> **Status**: APPROVED DISCOVERY DOCUMENTATION  
> **Scope**: Read-only codebase audit across all protected contexts, roles, backend authorities, security boundaries, and UI patterns.  
> **Target Design System**: Editorial Operations (Protected Extension of Editorial Freight)

---

## 1. Executive Overview & Repository Baseline

Phase R12 establishes the authoritative discovery baseline for rebuilding the protected KT Couriers web application. Following the conclusion of R1–R11 (which audited and refined the public cinematic web presence), R12 initiates the protected application workstream.

### 1.1 Core System Findings
- **Framework & Runtime**: Next.js 16.2.9 (App Router) on React 19.2.4 with TypeScript 5.x.
- **Styling Architecture**: Tailwind CSS v4 with custom CSS custom properties defined in `app/globals.css`.
- **Database & Data Authority**: PostgreSQL with Prisma ORM v5.22.0. Strict separation of server-side data fetching and client presentation via source-backed Data Transfer Objects (DTOs).
- **Authentication**: Custom DB-backed session management via httpOnly cookies (`lib/auth/guards.ts`, `lib/auth/session.ts`).
- **Authorization & Security**: Dual-layer RBAC and ABAC model (`lib/auth/permissions.ts`, `lib/auth/permission-keys.ts`). System supports 6 formal `UserRole` values and fine-grained `PermissionKey` overrides with explicit `ALLOW` / `DENY` effects.
- **Production Locks**: Hardened production locks across Subscriptions, Marketplace Checkout, Storefront Projections, Promotions, Advertising, and Catalog Media (`lib/*/production-lock.ts`).

---

## 2. Formal Roles & Protected Contexts

### 2.1 Formal `UserRole` Enum Analysis (`prisma/schema.prisma`)
The system contains six canonical roles:
1. `CUSTOMER`: Retail and business delivery clients.
2. `STORE`: Merchant catalog managers and storefront order fulfillers.
3. `DRIVER`: Courier network operators (mobile-first).
4. `PROMOTER`: Affiliates and growth program participants.
5. `ADMIN`: Administrative employees with delegated operational permissions.
6. `SUPER_ADMIN`: Root platform operators with unconditional system access.

### 2.2 Protected Non-Role Contexts
The repository includes dedicated protected workflows that operate under specific role scopes or pre-authentication stages:
- **Recruitment Applicant**: Operates under public/applicant routes (`app/(public)/applicant/*` and `app/(account)/applicant/*`), backed by `RecruitmentApplicationState` and candidate data protection boundaries.
- **Developer / Integration Owner**: Operates under `app/(account)/developers/*`, managing API credentials, scopes, and webhooks backed by `DeveloperApplication`.
- **Store Staff**: Delegated merchant staff operating within `app/(store)/store/*` under store-level entity scoping.
- **Invited User / Subscription Owner**: Entities participating in specialized enterprise billing or team features.

---

## 3. Permission Architecture Audit

### 3.1 Permission Structure & Categories (`lib/auth/permission-keys.ts`)
The platform implements 150+ granular permission keys categorized as follows:
- **Command Centre & Users**: `admin.dashboard.read`, `users.read`, `users.update`, `users.suspend`
- **Employee Management**: `employees.read`, `employees.create`, `employees.permissions.manage`
- **Domain Operations**: `customers.read`, `stores.read`, `drivers.read`, `orders.read`, `dispatch.read`, `regions.read`, `pricing.read`
- **Financial & Dual-Control**: `ledger.read`, `payments.read`, `withdrawals.review`, `withdrawals.approve`, `withdrawals.process`, `commissions.reverse`, `refunds.approve`, `store_earnings.reverse`
- **Catalog & Storefront**: `catalog.manage`, `catalog_moderation.review`, `storefront_collections.manage`
- **Subscriptions & Commercial**: `subscriptions.read`, `promotions.manage`, `advertising.manage`
- **Promoter & Recruitment**: `promoters.review`, `recruitment.read`, `recruitment_offers.approve`
- **Notifications & Developer**: `notification_template.manage`, `developer_application.approve`, `developer_webhook.operate`

### 3.2 Authorization Enforcement Rules
- **Backend Authority**: All Server Components and Server Actions must invoke `requireRole()` or `requirePermission()`.
- **Navigation Scoping**: Sidebar and rail navigation components filter items based on `getEffectivePermissionKeysForUser()`.
- **Hidden vs. Disabled State**: Action triggers missing write permissions are omitted entirely or disabled with clear contextual tooltips. Client-only authorization checks are strictly prohibited.

---

## 4. Financial UI & Audit Constraints

### 4.1 Immutable Accounting Ledger (`lib/ledger/`)
- All financial metrics (Customer Wallets, Store Earnings, Driver Earnings, Commissions, Refunds, Withdrawals) derive from append-only double-entry ledger entries.
- UI elements must display exact monetary strings (e.g. `R 1,250.00`) formatted server-side. Float math in client components is forbidden.

### 4.2 Maker-Checker Workflows
- High-risk operations (Withdrawal Approvals, Refund Releases, Commission Plan Activations, Store Earning Reversals) require independent secondary actor verification.
- The UI must render clear approval status badges, reviewer identity stamps, and reconciliation history timelines.

---

## 5. Production Locks & Security Boundaries

### 5.1 Active Production Lock Inventory
1. **Subscriptions (`lib/subscriptions/production-lock.ts`)**: Locks plan activation, recurring charges, and provider mutations (`SUBSCRIPTIONS_PRODUCTION_VALIDATION_APPROVED = false`).
2. **Marketplace Checkout (`lib/marketplace-checkout/production-lock.ts`)**: Locks live checkout execution until quote invariants are verified.
3. **Advertising (`lib/advertising/production-lock.ts`)**: Locks campaign activation and rate card billing.
4. **Promotions (`lib/promotions/production-lock.ts`)**: Locks automated budget settlement.
5. **Catalog Media (`lib/catalog/media/catalog-media-production-lock.ts`)**: Locks automated media cleanup.

---

## 6. Accessibility & Performance Audit

### 6.1 Accessibility Risks (Static Inspection)
- **Keyboard Traps**: Custom drawer and sheet components require `FocusTrap` wrapping and explicit `Esc` key handlers.
- **Data Tables**: Complex admin tables lack proper `aria-sort`, `caption`, or `scope="col"` headers in current implementation.
- **Color Contrast**: Operational badges must enforce WCAG AAA contrast ratios (4.5:1 for small text, 3:1 for large text).

### 6.2 Performance & Bundle Isolation
- **Server Component First**: All dashboard layouts and list views must remain Server Components. `"use client"` is restricted to interactive controls, forms, and chart mounts.
- **Font Strategy**: Dashboard pages will share Mona Sans (headings) and Newsreader (accents) with the public site using Next.js font optimization, eliminating runtime font loading overhead.
