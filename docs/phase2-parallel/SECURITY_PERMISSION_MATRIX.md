# Phase 2 Security & Permission Matrix

**Classification:** Internal Architectural & Security Specification  
**Scope:** Phase 2 Full Functional Delivery  
**Target Branch:** `phase2/antigravity-functional-completion-2026-10-11`  

---

## 1. Actor Role Definitions

| Role | Context & Identity Model | Primary Scope & Access Boundary |
|---|---|---|
| **ANONYMOUS** | Unauthenticated guest session with hashed capability cookie (`kt_public_quote`) | Public landing pages, anonymous quote calculation, store browsing. Denied access to private orders, customer profiles, and booking. |
| **CUSTOMER** | Authenticated customer account | Own profile, addresses, quote booking, orders, delivery tracking, read-only wallet projection, customer support conversations. |
| **STORE_OWNER** | Authenticated primary business account owner | Own store profile, full catalog, orders, substitutions, staff invitations & permission grants, expenses, store reviews. |
| **STORE_EMPLOYEE**| Authenticated store staff member with section-specific permissions | Bound to assigned store. Access limited strictly to granted sections (operations, marketing, finance, customer service). |
| **DRIVER** | Authenticated and approved delivery personnel | Assigned delivery jobs, workbench, pickup/delivery OTP verification, POD photo upload, driver cash custody read model, order-bound chat. |
| **SUPER_ADMIN** | Authenticated platform administrative personnel | Platform-wide configurations, delivery regions, tariffs, parcel profiles, driver/vehicle reviews, audited business support sessions. |

---

## 2. Resource Permission & Access Control Matrix

| Resource / Endpoint | Operation | Required Role / Permission | Tenant Boundary Enforcement | Explicit Negative / Denied Cases Tested |
|---|---|---|---|---|
| `/api/public/delivery-quotes` | POST (Create Quote) | Public / Any | Hashed guest token or customer ID | Invalid address outside coverage -> 409; distance exceeded -> 409; unconfigured service -> 503 |
| `/api/public/delivery-quotes/[id]` | GET (Read Quote) | Quote Owner (Guest or Customer) | Matches `ownerId` | Foreign user / mismatched cookie -> 404 Not Found |
| `/api/public/delivery-quotes/[id]/book` | POST (Book Delivery) | Authenticated `CUSTOMER` or `STORE` | Matches user ID & active workspace | Unauthenticated -> 401; expired quote -> 409; modified profile -> 409; replay -> 409 |
| `/api/account/profile` | GET / PATCH | Authenticated `CUSTOMER` | Matches `user.id` | Anonymous -> 401; Foreign user -> 403 Forbidden |
| `/api/account/addresses` | GET / POST / DELETE | Authenticated `CUSTOMER` | Matches `customerId` | Foreign address ID -> 404 / 403; Invalid coordinates -> 422 |
| `/api/customer-wallet` | GET (Read Model) | Authenticated `CUSTOMER` | Matches `user.id` | No direct ledger writes; spending deactivated; foreign user -> 403 |
| `/api/store/profile` | GET / PATCH | `STORE_OWNER` or Staff (`profile` perm) | Matches `store.id` via `storeAccess` | Foreign store ID -> 403; revoked staff -> 403 |
| `/api/store/catalog/products` | CRUD | `STORE_OWNER` or Staff (`products` perm) | Scoped to store ID | Cross-store product tampering -> 403; invalid variant pricing -> 422 |
| `/api/store/catalog/inventory/upload` | POST (CSV) | `STORE_OWNER` or Staff (`inventory` perm) | Scoped to store ID | Unbounded rows (>5000) -> 422; cross-store SKU update -> 403 |
| `/api/store/orders/[id]/actions` | POST (State transitions)| `STORE_OWNER` or Staff (`orders` perm) | Scoped to store ID | Mismatched store order -> 403; invalid state progression -> 409 |
| `/api/store/employees` | GET / POST / PATCH / DELETE | `STORE_OWNER` only | Scoped to store ID | Store staff cannot manage staff -> 403; foreign employee ID -> 404 / 403 |
| `/api/store/expenses` | GET (Query / CSV) | `STORE_OWNER` or Staff (`finance` perm) | Scoped to store ID | Staff lacking finance perm -> 403; foreign store data leakage -> 0 rows returned |
| `/api/driver/workbench` | GET | Approved `DRIVER` | Scoped to assigned driver ID | Unapproved driver -> 403; non-driver role -> 403 |
| `/api/driver/delivery/[id]/pickup` | POST (Verify OTP) | Assigned `DRIVER` | Matches driver assignment | Wrong driver -> 403; invalid / expired 6-digit OTP -> 422; duplicate use -> 409 |
| `/api/driver/delivery/[id]/pod` | POST (Upload POD) | Assigned `DRIVER` | Matches driver assignment | Wrong driver -> 403; invalid image raster / non-image -> 422 |
| `/api/driver/cash` | GET (Custody Read) | Active `DRIVER` | Scoped to driver ID | Foreign driver custody inspection -> 403; no direct journal writes |
| `/api/admin/business-support/[id]` | POST (Grant Support Session)| `SUPER_ADMIN` with `stores.read` | Scoped to requested store | Normal admin lacking perm -> 403; missing reason (<10 chars) -> 422; non-existent store -> 404 |
| `/api/admin/delivery-configuration`| POST / PATCH | `SUPER_ADMIN` with `pricing.manage` | Global platform config | Version conflict -> 409; unconfirmed Express parcel fees -> 422 |

---

## 3. Superuser Support Operational Boundaries
- **Audited Access Only:** Invoking `/api/admin/business-support/[id]` requires an explicit, audited reason (min 10 characters).
- **Time-Limited Session:** A `BusinessSupportAccess` record is generated with a strict 15-minute TTL (`expiresAt = createdAt + 15m`).
- **Audit Logging:** Every grant writes an immutable row into `AdminActivityLog` capturing `actorUserId`, `entityType: "BusinessSupportAccess"`, `metadata.reason`, and expiration timestamp.
- **Zero Silent Impersonation:** The user interface displays a prominent banner indicating an active read-only support session. Administrative actors are forbidden from executing financial transfers, customer wallet withdrawals, or forging transactions.

---

## 4. Media & Document Security Policies
- **MIME & Byte Bounds:** All media uploads (avatars, banners, product images, POD photos, driver licences) enforce strict binary magic-byte inspection and bounded sizes (avatars <= 2MB, documents <= 10MB).
- **Private Media Isolation:** Sensitive driver identity documents, vehicle registration papers, and delivery POD proofs are stored in private media directories and served only through authenticated, time-limited signed URLs. Foreign users cannot read another user's or driver's media objects.
- **Raster Sanitization:** Images are normalized through image processing pipelines to strip malicious EXIF metadata and prevent SVG/polyglot XSS attacks.

---

## 5. Export Security & Spreadsheet Formula Injection Defense
- **Formula Injection Defense:** `expenseCsv` validates every exported cell. Any value beginning with `=`, `+`, `-`, `@`, `\t`, `\r`, or `\n` is prefixed with `'` (unless it represents a strictly valid negative numeric value like `-129.50`).
- **Encoding & Compatibility:** Files are prefixed with the UTF-8 Byte Order Mark (`\ufeff`) to ensure consistent rendering in Microsoft Excel and LibreOffice Calc without formula interpretation.
- **Bounded Pagination:** Query ranges are enforced to a maximum of 366 days and a strict limit of 5,000 rows to prevent Denial-of-Service and memory exhaustion.
