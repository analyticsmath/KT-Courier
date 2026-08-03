# Settings Foundation

Phase 1.8 — DB-backed system settings with type validation and forbidden key enforcement.

## Model

`SystemSetting` in Prisma schema. Fields: `id`, `key` (unique), `label`, `type`, `value` (JSON), `description`.

Types: `STRING`, `NUMBER`, `BOOLEAN`, `JSON`.

## Forbidden keys

`isForbiddenKey()` in `lib/validation/admin-settings.ts` blocks any key containing:
`secret`, `api_key`, `private_key`, `token`, `password`, `credential`, `webhook_secret`.

This is enforced at the service layer (`updateSettingValue()`), not just the API. Settings must never be used to store credentials or secrets.

## Value validation

`validateSettingValue(type, rawValue)` checks the incoming value matches the setting's declared `type`:
- `STRING`: must be string, ≤ 2000 chars, trimmed
- `NUMBER`: accepts numeric string (parsed with `parseFloat`) or number
- `BOOLEAN`: `true`, `false`, or string `"true"` / `"false"`
- `JSON`: valid JSON object or parseable JSON string

Returns `{ ok: true, value }` or `{ ok: false, error }`.

## API

`GET /api/admin/settings` — returns all settings as `SystemSettingDto[]`.

`PATCH /api/admin/settings/[key]` — updates a single setting's value. Enforces forbidden key check and type validation. Records `AdminActivityLog` on success.

Both routes require ADMIN or SUPER_ADMIN.

## Admin UI

`SettingsManager` component (`components/admin/SettingsManager.tsx`) — client component. Renders one `SettingRow` per setting. Each row has its own save button and local state — saves are per-setting, not a single form submit. No page reload required; success indicator clears after 3 seconds.

Page: `app/(admin)/admin/settings/page.tsx`.

## Seeding

Settings are not seeded by Phase 1.8. The admin settings page shows an accurate empty state if no settings exist. Seed entries when specific platform-level toggles are needed in a future phase.
