# Contact Message Foundation

Phase 1.8 — Public contact form persisted to DB with admin review workflow.

## Model

`ContactMessage` in Prisma schema. Statuses: `NEW → READ → RESPONDED → ARCHIVED`.

Fields captured from the form: `name`, `email`, `phone` (optional), `enquiryType`, `message`, `status`.

## Email notifications (Phase 1.9)

When a contact message is submitted, two emails are sent (non-blocking):
1. `CONTACT_RECEIVED` — confirmation to the submitter
2. `ADMIN_CONTACT_MESSAGE` — notification to the admin/support recipient (determined by `EMAIL_REPLY_TO` or `EMAIL_FROM` env var; skipped if neither is set)

Email failures do not affect the success response returned to the user.

## Public submission

`POST /api/contact` — no authentication required.

Validates with `ContactFormSchema` (Zod) from `lib/validation/contact.ts`:
- `name`: 2–150 chars, trimmed
- `email`: valid email, max 200 chars
- `phone`: optional, max 30 chars
- `enquiryType`: one of `ENQUIRY_TYPES` enum
- `message`: 10–5000 chars, trimmed

On success returns a generic acknowledgement string — no internal IDs or status values exposed.

Calls `createContactMessage()` in `lib/services/admin-contact.service.ts`.

## Admin workflow

**List:** `GET /api/admin/contact-messages` — paginated, filterable by `status`, `enquiryType`, `search`. Page: `app/(admin)/admin/contact-messages/page.tsx`.

**Detail:** `GET /api/admin/contact-messages/[id]` — full message body. Page: `app/(admin)/admin/contact-messages/[id]/page.tsx`.

**Status update:** `PATCH /api/admin/contact-messages/[id]/status` — validates transition against `ALLOWED_STATUS_TRANSITIONS`. Returns 400 for invalid transitions, 404 for not found.

Client component `ContactMessageStatusUpdate` renders only the valid next states as button choices and calls the PATCH route.

## Status transitions

```
NEW        → READ, ARCHIVED
READ       → RESPONDED, ARCHIVED
RESPONDED  → ARCHIVED
ARCHIVED   → (terminal)
```

Every successful status update records an `AdminActivityLog` entry with `AdminActionType.STATUS_CHANGE`.

## DTOs

- `ContactMessageDto` — full detail (all fields)
- `ContactMessageSummaryDto` — list view (`messageSummary` truncated to 120 chars)

Never return raw Prisma `ContactMessage` objects to the client.
