# KT Couriers Phase R12 — Protected Application Defect & Technical Debt Register

> **Audit Context**: Static & Codebase Audit of Protected Defect Register  
> **Status**: AUTHORITATIVE DEFECT LOG (READ-ONLY)  
> **Rule**: Do not attempt to fix defects during R12. Log all issues for resolution in assigned phases.

---

## 1. Defect Severity Summary

| Severity | Definition | Discovered Count |
| :--- | :--- | :---: |
| **BLOCKER** | Prevents core route rendering or breaks fundamental authorization/data security. | 0 |
| **CRITICAL** | Severe UI breakage, broken list-detail state, or non-functional key form actions. | 4 |
| **HIGH** | Missing mobile optimization, unhandled empty/error states, or improper table layout. | 9 |
| **MEDIUM** | Inconsistent padding, accessibility focus state issues, or sub-optimal typography. | 14 |
| **LOW** | Minor visual alignment or cosmetic spacing inconsistencies. | 8 |
| **Total** | | **35** |

---

## 2. Categorized Defect & Debt Inventory

| Defect ID | Severity | Route / Component | Role Affected | Issue Description | Empirical Evidence | Recommended Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DEF-R12-001` | **CRITICAL** | `app/(admin)/admin/layout.tsx` | `ADMIN` / `SUPER_ADMIN` | Flat `ADMIN_NAV` array contains 30 items without workspace grouping or search. | `lib/constants/navigation.ts` L38-L69. | R13 |
| `DEF-R12-002` | **CRITICAL** | `components/layout/DashboardShell.tsx` | All Roles | Bottom navigation bar is hardcoded exclusively for `CUSTOMER` product mode. | `DashboardShell.tsx` L114-L146. | R13 |
| `DEF-R12-003` | **CRITICAL** | `app/(driver)/driver/delivery/page.tsx` | `DRIVER` | OTP verification form lacks camera file upload fallback for physical proof-of-delivery. | `delivery/page.tsx` inspection. | R16 |
| `DEF-R12-004` | **CRITICAL** | `app/(store)/store/catalog/media/page.tsx` | `STORE` | Page fails gracefully when `catalog-media-production-lock` is engaged. | `production-lock.ts` check missing UI error state. | R15 |
| `DEF-R12-005` | **HIGH** | `components/ui/DataTable.tsx` | All Roles | Data table component forces horizontal scrolling on 320px viewports without card collapse. | `DataTable.tsx` responsive layout inspection. | R13 |
| `DEF-R12-006` | **HIGH** | `app/(account)/account/orders/[id]/page.tsx` | `CUSTOMER` | Order detail page lacks live status refresh indicator or polling boundary. | `orders/[id]/page.tsx` inspection. | R14 |
| `DEF-R12-007` | **HIGH** | `app/(admin)/admin/dispatch/page.tsx` | `ADMIN` | Dispatch map frame lacks fallback when Google Maps API key is unconfigured. | `dispatch/page.tsx` map initialization check. | R20 |
| `DEF-R12-008` | **HIGH** | `app/(account)/promoter/links/page.tsx` | `PROMOTER` | Link builder form does not perform immediate client-side input validation for custom slugs. | `promoter/links/page.tsx` inspection. | R17 |
| `DEF-R12-009` | **HIGH** | `app/(account)/developers/[[...segments]]/page.tsx` | `DEVELOPER` | Catch-all developer route lacks granular navigation tabs for Webhooks vs API Keys. | `developers/[[...segments]]/page.tsx` inspection.| R18 |
| `DEF-R12-010` | **HIGH** | `app/(public)/applicant/applications/page.tsx` | Candidate | Application status list lacks clear timeline stage indicator for conditional checks. | `applicant/applications/page.tsx` inspection. | R19 |
| `DEF-R12-011` | **HIGH** | `app/(admin)/admin/withdrawals/page.tsx` | `ADMIN` | Maker-checker dual control lacks visual highlight when current user is original requester. | `withdrawals/page.tsx` action button check. | R21 |
| `DEF-R12-012` | **HIGH** | `app/(store)/store/orders/[id]/page.tsx` | `STORE` | Item substitution form does not display customer price adjustment preview. | `store/orders/[id]/page.tsx` inspection. | R15 |
| `DEF-R12-013` | **HIGH** | `app/(admin)/admin/permissions/page.tsx` | `SUPER_ADMIN` | Permission matrix grid lacks column filter by system permission category. | `permissions/page.tsx` inspection. | R21 |
| `DEF-R12-014` | **MEDIUM** | `components/ui/Badge.tsx` | All Roles | Status badge colors use ad-hoc Tailwind classes rather than centralized semantic tokens. | `Badge.tsx` class inspection. | R13 |
| `DEF-R12-015` | **MEDIUM** | `components/ui/Drawer.tsx` | All Roles | Drawer component missing `aria-describedby` association and `FocusTrap` wrapper. | `Drawer.tsx` accessibility inspection. | R13 |
| `DEF-R12-016` | **MEDIUM** | `components/ui/Modal.tsx` | All Roles | Modal overlay lacks background scroll lock on body element. | `Modal.tsx` inspection. | R13 |
| `DEF-R12-017` | **MEDIUM** | `app/(account)/account/wallet/page.tsx` | `CUSTOMER` | Payout destination form does not mask account numbers during edit. | `wallet/page.tsx` form field inspection. | R14 |
| `DEF-R12-018` | **MEDIUM** | `app/(driver)/driver/availability/page.tsx` | `DRIVER` | Shift toggle controls lack explicit touch target padding (min 44x44px). | `availability/page.tsx` button size inspection. | R16 |
| `DEF-R12-019` | **MEDIUM** | `app/(admin)/admin/ledger/page.tsx` | `ADMIN` | Journal list table missing monetary column alignment (`text-right` + tabular nums). | `ledger/page.tsx` table cell styling check. | R21 |
| `DEF-R12-020` | **MEDIUM** | `app/(store)/store/earnings/page.tsx` | `STORE` | Earning reversal form lacks clear confirmation step before submitting reversal request. | `store/earnings/page.tsx` form check. | R15 |
| `DEF-R12-021` | **MEDIUM** | `app/(account)/promoter/withdrawals/page.tsx` | `PROMOTER` | Available balance vs held balance callout card lacks explanation tooltip. | `promoter/withdrawals/page.tsx` inspection. | R17 |
| `DEF-R12-022` | **MEDIUM** | `app/(public)/applicant/profile/page.tsx` | Candidate | File uploader component lacks clear file size and format warning text. | `applicant/profile/page.tsx` inspection. | R19 |
| `DEF-R12-023` | **MEDIUM** | `app/(admin)/admin/notifications/templates/page.tsx` | `ADMIN` | Resend HTML preview pane lacks mobile device viewport toggle. | `notifications/templates/page.tsx` inspection. | R21 |
| `DEF-R12-024` | **MEDIUM** | `app/(account)/account/addresses/page.tsx` | `CUSTOMER` | Saved address card missing primary delivery location indicator badge. | `addresses/page.tsx` card inspection. | R14 |
| `DEF-R12-025` | **MEDIUM** | `app/(store)/store/inventory/page.tsx` | `STORE` | Low stock inventory alert panel lacks bulk reorder trigger button. | `inventory/page.tsx` inspection. | R15 |
| `DEF-R12-026` | **MEDIUM** | `components/ui/StatCard.tsx` | All Roles | Metric tile component lacks support for secondary comparison timeframe text. | `StatCard.tsx` prop inspection. | R13 |
| `DEF-R12-027` | **MEDIUM** | `components/ui/EmptyState.tsx` | All Roles | Generic empty state component uses plain icon instead of 2D editorial illustration. | `EmptyState.tsx` inspection. | R13 |
| `DEF-R12-028` | **LOW** | `app/(account)/account/profile/page.tsx` | `CUSTOMER` | Profile header avatar initials fallback uses incorrect font weight. | `profile/page.tsx` styling check. | R14 |
| `DEF-R12-029` | **LOW** | `app/(store)/store/profile/page.tsx` | `STORE` | Store operating hours input fields display non-standard 24h format label. | `store/profile/page.tsx` field check. | R15 |
| `DEF-R12-030` | **LOW** | `app/(driver)/driver/profile/page.tsx` | `DRIVER` | Driver license expiry badge spacing is off by 2px on mobile viewports. | `driver/profile/page.tsx` layout check. | R16 |
| `DEF-R12-031` | **LOW** | `app/(account)/promoter/profile/page.tsx` | `PROMOTER` | Tax reference field helper text has minor punctuation typo. | `promoter/profile/page.tsx` text check. | R17 |
| `DEF-R12-032` | **LOW** | `app/(admin)/admin/activity/page.tsx` | `ADMIN` | Activity log table missing quick search input filter by actor name. | `activity/page.tsx` inspection. | R21 |
| `DEF-R12-033` | **LOW** | `app/(public)/applicant/privacy/page.tsx` | Candidate | POPIA data subject request form submit button text is slightly wordy. | `applicant/privacy/page.tsx` text check. | R19 |
| `DEF-R12-034` | **LOW** | `components/ui/LoadingSkeleton.tsx` | All Roles | Loading skeleton pulse animation lacks `motion-reduce:animate-none` class. | `LoadingSkeleton.tsx` inspection. | R13 |
| `DEF-R12-035` | **LOW** | `app/(admin)/admin/settings/page.tsx` | `ADMIN` | System parameters save button lacks sticky bottom bar container. | `settings/page.tsx` inspection. | R21 |
