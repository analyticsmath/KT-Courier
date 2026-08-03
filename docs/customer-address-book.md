# Customer Address Book

Phase 2.3 adds customer-owned saved addresses for repeat pickup and dropoff workflows.

## Behavior

- Customers manage saved addresses at `/account/addresses`.
- Saved addresses can be labelled and marked as default by address type.
- Supported customer address types: `PICKUP`, `DROPOFF`, and `CUSTOMER`.
- Request delivery supports choosing saved pickup or dropoff addresses.
- Google Places data is stored when available: `formattedAddress`, `placeId`, `latitude`, and `longitude`.
- Manual address entry remains supported when Google Maps browser keys are missing.

## Data Model

Saved customer addresses reuse the `Address` model with:

- `userId` set to the owning customer user.
- `storeId` left null.
- `isDefault` used for default-per-type behavior.

Order pickup and dropoff addresses remain separate snapshot `Address` rows. A saved address is copied into a new order request and later edits do not change historical orders.

## Security

- API routes require an authenticated `CUSTOMER`.
- Customers can only list, create, update, or delete addresses with their own `userId`.
- Mutations use Zod validation, origin checks, safe error responses, and address mutation rate limiting.
- Deletion is blocked if an address is somehow linked to order snapshot relations.

## Files

- `lib/validation/address-book.ts`
- `lib/services/customer-addresses.service.ts`
- `app/api/account/addresses/route.ts`
- `app/api/account/addresses/[id]/route.ts`
- `components/account/AddressBookManager.tsx`
- `app/(account)/account/addresses/page.tsx`
