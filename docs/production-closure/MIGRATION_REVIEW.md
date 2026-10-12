# Candidate migration review

These forward-only migrations are candidate source changes. Neither migration
has been applied to production. Protected production counts and full-row hashes
remain unverified; deployment must wait for the approved read-only audit and all
release gates.

## Guest contact notification authority

`20261007000000_guest_contact_notification_authority` adds guest email verification
evidence with restricted foreign keys to the existing checkout and immutable
contact snapshot. It does not create a user, rewrite a contact, or touch payment,
ledger or order rows. Public APIs return the challenge reference and verification
status; six-digit codes remain encrypted in the security email outbox and keyed
in verification evidence. Delivery resolves the current contact again. Replaced
contacts and claimed checkouts lose their previous guest authority.

Prisma explicitly maps the two long contact indexes to PostgreSQL's existing
63-byte names. This preserves the applied indexes and avoids a spurious rename
in the fresh database-to-schema drift check. The original SQL is unchanged.

## Inventory reservation evidence

The exact-SHA certification of `20ccdc37f489a369dac585a850c5a0905b0ccaee`
rejected both final-unit reservation contenders because
`CatalogInventoryMovement_result_check` prohibited zero deltas. Reservation and
release operations change reserved/available stock while leaving physical
on-hand stock unchanged. Their immutable movement evidence therefore legitimately
uses zero physical delta.

`20261007010000_inventory_reservation_evidence` atomically replaces that single
check. Zero delta is permitted only for reservation, reservation release,
substitution reservation and substitution release. Physical movements still
require a non-zero delta. Non-negative resulting stock and operation/hash bounds
are retained. No data is rewritten or removed, and the old migration remains
unchanged. The migration checker exception matches only that exact constraint
drop in that exact migration folder.

The real PostgreSQL stock-race test now asserts zero-delta reservation evidence,
one winning reservation, durable release, and rejection of a zero-delta physical
correction. Both the marketplace PostgreSQL race and storefront jobs passed
at `a6717014f5ad024b6fa587c19a8742d3b31d13b5`. The full workflow still failed,
so this evidence does not authorize merge or production migration.
