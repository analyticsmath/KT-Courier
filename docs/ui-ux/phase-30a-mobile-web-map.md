# Phase 30A — Mobile Web Mapping

This document maps the 24 required customer mobile-web compositions to their shared routes, data sources, backend actions, and corresponding desktop screens.

| # | Mobile Composition | Shared Route | Shared Data Source | Shared Action | Corresponding Desktop Screen |
|---|---|---|---|---|---|
| 1 | Mobile Home | `/account` | `prisma.order`, `listCustomerAddresses` | Repeat booking link, details view | Desktop Customer Dashboard |
| 2 | Service Selector | `/account/request-delivery` | `getDeliveryTypeConfig` | Selection click | Service category cards grid |
| 3 | Quick Parcel Booking | `/account/request-delivery` | Form draft | Input changes | Step-by-step wizard panel |
| 4 | Address Search & Map Pin | `/account/request-delivery` | `AddressAutocomplete` | Autocomplete select | Google Map address panel |
| 5 | Schedule Selector | `/account/request-delivery` | Regional schedule slots | Dropdown choice | Timeline slot grid |
| 6 | Quote Options | `/account/request-delivery` | `/api/pricing` | Option click | Pricing estimate tables |
| 7 | Booking Review | `/account/request-delivery` | Form draft DTO | Submit checkout | Confirmation sidebar summary |
| 8 | Payment Handoff | `/orders/[id]/payment` | PayFast billing config | Payment redirect | PayFast redirect screen |
| 9 | Booking Confirmation | `/account/orders/[id]` | Confirmed order DTO | Return to dashboard | Thank you screen with map |
| 10 | Marketplace Home | `/shop` | Active storefront catalog | Add-to-cart click | Storefront grid with hero |
| 11 | Search & Category | `/shop/search` | Search index query | Search query input | Desktop filter side panel |
| 12 | Product Detail | `/shop/products/[id]` | `getStorefrontProduct` | Variant select | Two-column product specs |
| 13 | Cart | `/cart` | Client-side cookie cart | Checkout click | Cart drawer overlay |
| 14 | Checkout | `/checkout` | Order total, tax DTO | Finalize order | Split checkout billing page |
| 15 | Orders | `/account/orders` | `prisma.order.findMany` | Search, filter click | Orders datatable list |
| 16 | Order Detail | `/account/orders/[id]` | `prisma.order.findFirst` | Support query | Delivery status panels |
| 17 | Live Tracking | `/account/orders/[id]` | `CUSTOMER_STATUS_COPY` | Refresh state | Desktop map and timeline |
| 18 | Driver & Handoff Contact | `/account/orders/[id]` | Order driver details | Call, message driver | Sidebar driver card |
| 19 | Wallet | `/account/wallet` | `prisma.ledger` | Filter transaction | Wallet transaction rows |
| 20 | Membership | `/account/membership` | Customer subscription | Cancel, renew clicks | Plan details & invoice table |
| 21 | Notifications | `/account/notifications` | User notifications DB | Mark read click | Full inbox feed panel |
| 22 | Profile & Settings | `/account/profile` | User DB profile | Update details | Tabbed profile settings |
| 23 | Support | `/account/support` | Ticket DB logs | Submit ticket | Support ticket grid |
| 24 | Offline / Reconnect | Global layout banner | `navigator.onLine` | Trigger reload | Top-bar alert callout |
