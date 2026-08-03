# Admin Operations Foundation (updated Phase 1.9)

Phase 1.8 — Centralised admin area with real DB data, activity audit trail, and operational controls.

## Admin Dashboard

Single entry point: `getAdminDashboardData()` in `lib/services/admin-dashboard.service.ts`.

Runs **19 parallel queries** via `Promise.all()` and returns:

```ts
interface AdminDashboardData {
  stats: AdminDashboardStats;   // 15 count fields from DB
  recentOrders: OrderSummaryDto[];          // last 5
  recentStores: AdminStoreListItem[];       // last 10
  recentContactMessages: ContactMessageSummaryDto[]; // last 5
  recentAdminActivity: AdminActivityDto[];  // last 10
}
```

All data is real DB — no mock values. The dashboard page at `app/(admin)/admin/page.tsx` shows contextual alerts when `pendingStores > 0` or `contactMessagesNew > 0`.

## Activity Log

Model: `AdminActivityLog` in Prisma schema.

Writer: `recordAdminActivity()` in `lib/services/admin-activity.service.ts` — **non-blocking**, wraps `prisma.create()` in `try/catch` so activity logging can never fail a primary operation.

Reader: `listAdminActivity(filters)` — paginated, filterable by `action`, `entityType`, `actorUserId`, and free-text search.

API: `GET /api/admin/activity` — ADMIN/SUPER_ADMIN only.

Page: `app/(admin)/admin/activity/page.tsx` — shows real logs with action badge colours.

### Security: metadata sanitisation

`toAdminActivityDto()` calls `sanitizeMetadata()` before returning data to the client. This strips:
- Keys starting with `_` (Prisma internals)
- Keys matching `/hash|token|secret|password|otp|pin/i`
- Non-primitive values (objects, arrays)

## Mutating operations that trigger activity logs

| Operation | Service | Action type |
|-----------|---------|-------------|
| Order status update | `admin-orders.service` | `STATUS_CHANGE` |
| Store status update | `admin-stores.service` | `STATUS_CHANGE` |
| Pricing rule create/update/delete | `admin-pricing.service` | `CREATE` / `UPDATE` / `DELETE` |
| Contact message status update | `admin-contact.service` | `STATUS_CHANGE` |
| System setting update | `admin-settings.service` | `UPDATE` |

## Role enforcement

All admin API routes and pages enforce `ALLOWED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN]`.

Layout-level guard: `requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN)` in `app/(admin)/admin/layout.tsx`.

Pages add a second check via `getCurrentUser()` + redirect, so even if layout is bypassed, individual pages are protected.

**ADMIN cannot promote users to SUPER_ADMIN.** This constraint lives in `admin-users.service.ts` and is not relaxed anywhere.

## Email logs (Phase 1.9)

Admin email logs at `/admin/emails` now show real DB-backed EmailLog records with:
- Status filter tabs (All / Pending / Sent / Failed)
- Clickable rows linking to `/admin/emails/[id]` detail page
- Provider status banner (console fallback notice or active provider confirmation)
- Test email form (`POST /api/admin/emails/test`)

API routes:
- `GET /api/admin/emails/logs` — paginated list
- `GET /api/admin/emails/logs/[id]` — single log detail
- `POST /api/admin/emails/test` — send test Welcome email, ADMIN/SUPER_ADMIN only
