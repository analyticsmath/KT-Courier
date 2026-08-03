# Phase 2 Employee Permissions

## Summary

Phase 2 adds a permission-based employee/admin access layer while preserving the existing broad `User.role` model.

`User.role` remains the account type:

- `SUPER_ADMIN` has full command-centre access by default and is still audited.
- `ADMIN` is an employee/staff role controlled by permissions once permission rows exist.
- `CUSTOMER`, `STORE`, and `DRIVER` portal access remains role-based and unchanged.

## Data Model

`AdminProfile` is reused as the employee profile. Phase 2 adds nullable `department` and `phone` fields to it.

The permission models are:

- `Permission`: canonical system permission records keyed by stable strings such as `orders.read`.
- `RolePermission`: default permission grants for a broad role, primarily `ADMIN`.
- `UserPermission`: explicit per-user `ALLOW` or `DENY` overrides.
- `PermissionEffect`: `ALLOW` or `DENY`.

Permission checks never use display names. They use stable keys from `lib/auth/permission-keys.ts`.

## Evaluation Rules

Effective permission checks follow this order:

1. `SUPER_ADMIN` is allowed for every admin permission check.
2. Non-admin roles are denied for admin permissions.
3. Explicit `UserPermission` `DENY` denies access.
4. Explicit `UserPermission` `ALLOW` allows access.
5. Enabled `RolePermission` allows access.
6. If the `Permission` table is empty, legacy `ADMIN` access is temporarily allowed.
7. Otherwise access is denied.

The empty-table fallback exists only for rollout compatibility. Once any permission row exists, `ADMIN` users must satisfy permission checks normally.

## Registry

The permission registry lives in `lib/auth/permission-keys.ts`.

Categories:

- Command Centre
- Users
- Employees
- Customers
- Stores
- Drivers
- Orders
- Dispatch
- Regions
- Pricing
- Settings
- Activity
- Emails
- Contacts
- Security
- Finance
- Reports

Finance and reports permissions are placeholders only. Phase 2 does not implement finance or reporting modules.

## Admin Route Mapping

| Route Area | Permission |
|---|---|
| `/api/admin/activity` | `activity.read` |
| `/api/admin/users` | `users.read` |
| `/api/admin/users/[id]` read | `users.read` |
| `/api/admin/users/[id]` profile update | `users.update` |
| `/api/admin/users/[id]` status update | `users.suspend` |
| `/api/admin/stores` | `stores.read` |
| `/api/admin/stores/[id]` read | `stores.read` |
| `/api/admin/stores/[id]` update | `stores.update` |
| `/api/admin/stores/[id]/status` | `stores.approve` |
| `/api/admin/stores/[id]/featured` | `stores.feature` |
| `/api/admin/drivers` read | `drivers.read` |
| `/api/admin/drivers` create | `drivers.create` |
| `/api/admin/drivers/[id]` read | `drivers.read` |
| `/api/admin/drivers/[id]` update | `drivers.update` |
| `/api/admin/drivers/[id]/status` | `drivers.status.manage` |
| `/api/admin/drivers/[id]/availability` | `drivers.status.manage` |
| `/api/admin/drivers/[id]/regions` | `drivers.regions.manage` |
| `/api/admin/dispatch` | `dispatch.read` |
| `/api/admin/orders` | `orders.read` |
| `/api/admin/orders/[id]` read | `orders.read` |
| `/api/admin/orders/[id]/status` | `orders.status.manage` |
| `/api/admin/orders/[id]/assign` | `dispatch.assign` |
| `/api/admin/orders/[id]/reassign` | `dispatch.override` |
| `/api/admin/orders/[id]/unassign` | `dispatch.override` |
| `/api/admin/orders/[id]/operational-events` | `orders.read` |
| `/api/admin/orders/[id]/operational-note` | `orders.update` |
| `/api/admin/orders/[id]/proof-of-delivery` read | `orders.read` |
| `/api/admin/orders/[id]/proof-of-delivery` write | `orders.update` |
| `/api/admin/pickup-exceptions` | `dispatch.read` |
| `/api/admin/delivery-exceptions` | `dispatch.read` |
| `/api/admin/contact-messages` | `contacts.read` |
| `/api/admin/contact-messages/[id]` | `contacts.read` |
| `/api/admin/contact-messages/[id]/status` | `contacts.update` |
| `/api/admin/regions` read | `regions.read` |
| `/api/admin/regions` write | `regions.manage` |
| `/api/admin/regions/[id]` write | `regions.manage` |
| `/api/admin/pricing/rules` read | `pricing.read` |
| `/api/admin/pricing/rules` write | `pricing.manage` |
| `/api/admin/pricing/rules/[id]` write | `pricing.manage` |
| `/api/admin/settings` | `settings.read` |
| `/api/admin/settings/[key]` | `settings.update` |
| `/api/admin/emails/logs` | `emails.read` |
| `/api/admin/emails/logs/[id]` | `emails.read` |
| `/api/admin/emails/test` | `emails.test` |
| `/api/admin/employees` read | `employees.read` |
| `/api/admin/employees` create | `SUPER_ADMIN` only |
| `/api/admin/employees/[id]` read | `employees.read` |
| `/api/admin/employees/[id]` update | `employees.update` |
| `/api/admin/employees/[id]/permissions` | `employees.permissions.manage` |
| `/api/admin/permissions` read | `employees.permissions.manage` |
| `/api/admin/permissions` sync | `SUPER_ADMIN` only |
| `/api/admin/permissions/roles/[role]` read | `employees.permissions.manage` |
| `/api/admin/permissions/roles/[role]` update | `SUPER_ADMIN` only |

Admin UI pages that read privileged service data are also gated by matching page-level permission checks.

## Seed And Sync

`prisma/seed.ts` idempotently upserts all system permissions and default `ADMIN` role grants.

`POST /api/admin/permissions` performs the same sync without running development seed. It is restricted to `SUPER_ADMIN`.

Default `ADMIN` role grants:

- `admin.dashboard.read`
- `users.read`
- `customers.read`
- `stores.read`
- `drivers.read`
- `orders.read`
- `dispatch.read`
- `regions.read`
- `pricing.read`
- `activity.read`
- `emails.read`
- `contacts.read`

## Migration Workflow

The local database endpoint remained unreachable during Phase 2 validation, so the migration was generated with Prisma diff fallback:

`npx prisma migrate diff --from-schema-datamodel .tmp-prisma-schema-before-phase2.prisma --to-schema-datamodel prisma/schema.prisma --script`

The generated migration is additive only.

## Deferred Work

- Frontend permission-management polish.
- Full automated test suite.
- Finance module behavior behind `finance.read`.
- Reporting behavior behind `reports.read` and `reports.export`.
- Full two-factor authentication.
- Public API permissions and API key/webhook management.
- Security dashboard UI.
