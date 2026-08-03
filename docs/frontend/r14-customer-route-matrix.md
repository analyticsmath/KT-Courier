# R14 — Verified customer route matrix

## Verification basis

This matrix follows the live `app/(account)/account` route tree, not the conceptual R12 list. The account layout requires `CUSTOMER`, resolves filtered navigation on the server, and is the only account layout boundary. There are no account-local `loading`, `error`, or `not-found` files; the root boundaries apply. All account pages are noindex through their protected route boundary.

| ID | Path | Authority / DTO | Composition and mobile behavior | State, validation, and risk |
| --- | --- | --- | --- | --- |
| C01 | `/account` | `prisma.order`, `toOrderSummaryDto` | Server overview; active panel and structured recent list | Concrete; direct counts; stable active-order selection; medium presentation risk |
| C02 | `/account/request-delivery` | `DeliveryRequestForm`, pricing quote and order APIs | Progressive client form in server page; one column on mobile | Concrete; existing validation/quote/order authority; map-provider limitation |
| C03 | `/account/request-delivery/freight` | No booking DTO | Truthful unavailable state | Locked/unavailable; no fake freight form |
| C04 | `/account/request-delivery/moving` | No estimate DTO | Truthful unavailable state | Locked/unavailable; no fake moving inventory |
| C05 | `/account/request-delivery/shuttle` | No reservation DTO | Truthful unavailable state | Locked/unavailable; no fake seat scheduling |
| C06 | `/account/orders` | `listOrders`, `OrderSummaryDto` | Server-filtered table on desktop; semantic record list on mobile | Concrete; owned DTO; `status` and `page` use existing list support |
| C07 | `/account/orders/[id]` | `getOrder`, `OrderDetailDto`, public POD DTO | Dedicated server detail route; one column mobile timeline | Concrete; server ownership; public-safe fields only |
| C08 | `/account/orders/[id]/exception` | `getOrder` ownership check | Truthful unavailable state; returns to owned detail | Partial; no rescheduling authority, no fake custody state |
| C09 | `/account/addresses` | `listCustomerAddresses`, `SavedAddressDto` | Server wrapper and existing interactive address manager | Concrete; owned address APIs; touch-friendly cards |
| C10 | `/account/recipients` | No recipient-book DTO | Truthful unavailable state | Partial; no fixture recipients |
| C11 | `/account/wallet` | `getCustomerWalletSummary`, wallet transaction projection | Source-backed summaries and activity table; stacked table mobile | Concrete; exact decimal strings, read-only wallet |
| C12 | `/account/wallet/transactions` | `listCustomerWalletTransactions` | Paginated server table; stacked records mobile | Concrete; no ledger account/journal field rendered |
| C13 | `/account/wallet/payment-methods` | No safe payment-method DTO | Truthful unavailable state | Partial; no fixture cards or fake card management |
| C14 | `/account/refunds` | `listCustomerRefunds`, customer refund DTO | Request form plus source-backed history; stacked records mobile | Concrete with production lock; no provider/ledger evidence |
| C15 | `/account/refunds/[publicReference]` | `getCustomerRefund`, customer detail DTO | Dedicated detail with status timeline | Concrete with production lock; server ownership; no internal review evidence |
| C16 | `/account/withdrawals` | `getOwnerWithdrawalOverview`, `listOwnerWithdrawals` | Source-backed summary, existing request form, stacked records mobile | Concrete with production lock; destination masking retained |
| C17 | `/account/withdrawals/[publicReference]` | `getOwnerWithdrawal` | Dedicated detail and customer-safe timeline | Concrete; owner query; no payout/provider internals |
| C18 | `/account/payout-destinations` | `listOwnerPayoutDestinations` | Read-only table; stacked mobile records | Concrete; only masked destination data |
| C19 | `/account/membership` | Subscription production lock; no customer contract projection | Truthful unavailable state | Locked; no inferred plan or benefit |
| C20 | `/account/membership/benefits` | No active entitlement projection | Truthful unavailable state | Partial/locked; no fictional benefits |
| C21 | `/account/membership/invoices` | No customer invoice projection | Truthful unavailable state | Partial/locked; no fictional invoice rows |
| C22 | `/account/notifications` | customer notification projection | Server-rendered inbox; semantic list on all widths | Concrete; only title/body/state/timestamp projection |
| C23 | `/account/profile` | `getCustomerProfile`, existing profile mutation | Server panel with client form | Concrete; existing profile validation remains authoritative |
| C24 | `/account/security` | No customer session DTO or revoke authority | Truthful unavailable state | Partial; no fixture devices/IP addresses |
| C25 | `/account/support` | Existing `/contact` pathway | Server help page; one clear action | Concrete route but no ticket DTO; no fake ticket history |
| C26 | `/account/promotions` | No customer promotion balance/redeem DTO | Truthful unavailable state | Partial; no fake coupon or application action |
| C27 | `/account/business` | No business-team DTO | Truthful unavailable state | Partial; no fixture team or member actions |

## Route implementation map

| Route family | Server/client boundary | Backend authority retained | R14 presentation change | Accessibility / security risk |
| --- | --- | --- | --- | --- |
| Overview and orders | Server pages; no page-wide hydration | Existing owned queries and order DTOs | Active work first, deterministic selection, mobile record list | Statuses must stay customer-safe; unknown values show unavailable |
| Request delivery | Server data/options; existing client form island | Existing pricing quote, region, order submission, same-origin and rate-limit APIs | Protected frame around one canonical form | Provider-unavailable text entry cannot issue a fake quote or route |
| Addresses and profile | Server pages with existing client form islands | Existing owned address/profile APIs | Protected panels and headers | Existing mutations retain server ownership and validation |
| Wallet/refunds/withdrawals | Server pages; existing request/cancel islands only | Existing money, refund, and withdrawal queries/services | Decimal-safe money text, semantic history/tables, locked states | No ledger IDs, provider payloads, account numbers, or review evidence |
| Notifications | Server-only customer-safe projection | Existing inbox model | Compact semantic inbox | No raw inbox model leaves server presentation |
| Unsupported domains | Server-only unavailable state | No invented authority | Honest unavailable state rather than fixtures | No fake data, fake actions, or lock bypass |

## Route contract addendum

All rows require the account layout's `CUSTOMER` guard, use server-side ownership where a record is present, retain protected noindex behavior, and inherit the R13 protected shell. “None” means no customer-safe authority exists and R14 intentionally renders an unavailable state rather than adding one.

| ID | Page title / purpose | Primary and secondary action | Form, table/list, timeline, map | Financial / production lock / risk |
| --- | --- | --- | --- | --- |
| C01 | My delivery desk — active work | Request delivery; view deliveries | Metrics, active panel, list; no map | No finance; no lock; low |
| C02 | Request a delivery — canonical new order | Continue/submit; back/edit steps | Existing progressive form/review; provider route only | Quote authority; provider risk; high |
| C03 | Book cargo freight — unsupported freight | Back to parcel request | No form/list/map | No payment; locked/unavailable; low |
| C04 | Book furniture removal — unsupported moving | Back to parcel request | No form/list/map | No payment; locked/unavailable; low |
| C05 | Book shuttle transit — unsupported shuttle | Back to parcel request | No form/list/map | No payment; locked/unavailable; low |
| C06 | My deliveries — owned order records | Request delivery; filter/page/detail | Desktop table + mobile list; no map | Amount omitted; no lock; medium |
| C07 | Delivery details — owned delivery | Payment/create similar/back/cancel | Detail panels and ordered timeline; no map | Server amount; existing payment route; high privacy |
| C08 | Delivery exception — owned delivery support | Back to delivery | No fictional form/timeline/map | No finance; no reschedule authority; low |
| C09 | Saved addresses — owned address book | Add/edit/default/delete | Existing address cards/form; provider text fallback | No finance; provider risk; medium |
| C10 | Saved recipients — unsupported book | Request delivery | No fixture list or form | No finance; no authority; low |
| C11 | Wallet — owned refund credit view | View activity | Summary and stacked table; no map | Decimal `ZAR`, read-only; medium |
| C12 | Wallet activity — owned ledger projection | Back to wallet/page | Stacked table; no ledger fields | Decimal `ZAR`; low |
| C13 | Payment methods — unsupported safe DTO | Back to overview | No fixture cards/form | Payment boundary; unavailable; low |
| C14 | Refunds — owned requests | Existing request form/detail | Stacked table; no provider map | Decimal `ZAR`; execution locked; high |
| C15 | Refund request — owned record | Cancel/back | Detail and ordered timeline | Decimal `ZAR`; execution locked; high |
| C16 | Withdrawals — owner financial requests | Existing request form/destination/history | Stacked table; no map | Decimal `ZAR`; production lock; high |
| C17 | Withdrawal request — owner record | Cancel/back | Detail and ordered timeline | Decimal `ZAR`; no provider internals; high |
| C18 | Payout destinations — masked owner refs | Back to withdrawals | Read-only stacked table | Masked financial data; medium |
| C19 | Membership — subscription state | Back to overview | Unavailable state | Subscription lock; low |
| C20 | Membership benefits — entitlement state | Back to membership | Unavailable state | Subscription lock; low |
| C21 | Membership invoices — billing records | Back to membership | Unavailable state | Subscription lock; low |
| C22 | Notifications — account inbox | None | Semantic list; no map | No financial data; low |
| C23 | Profile — personal account details | Save/reset password | Existing profile form | Privacy risk; medium |
| C24 | Security — session controls | Reset password | Unavailable state | Security authority absent; high |
| C25 | Support — contact pathway | Contact support | Help panels; no ticket fixture | No finance; low |
| C26 | Promotions — customer offers | Back to overview | Unavailable state | No promotion authority; low |
| C27 | Business team — business access | Back to overview | Unavailable state | No team authority; medium |
