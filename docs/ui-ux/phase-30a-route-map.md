# Phase 30A — Route Mapping Guide

This document lists the complete Next.js App Router hierarchy in KT Couriers, showing which files handle which HTTP request routes.

---

## 1. Public Marketing Routes

All marketing and informational pages are grouped under the `(public)` route group to separate them from secure logged-in screens.

*   **Home Page**: `/`
    *   *Handler File*: `app/(public)/page.tsx`
*   **Services Overview**: `/services`
    *   *Handler File*: `app/(public)/services/page.tsx`
*   **Service Sub-pages**:
    *   `/services/parcel` -> `app/(public)/services/parcel/page.tsx`
    *   `/services/ecommerce` -> `app/(public)/services/ecommerce/page.tsx`
    *   `/services/food` -> `app/(public)/services/food/page.tsx`
    *   `/services/grocery` -> `app/(public)/services/grocery/page.tsx`
    *   `/services/pharmacy` -> `app/(public)/services/pharmacy/page.tsx`
    *   `/services/moving` -> `app/(public)/services/moving/page.tsx`
    *   `/services/freight` -> `app/(public)/services/freight/page.tsx`
    *   `/services/shuttle` -> `app/(public)/services/shuttle/page.tsx`
    *   `/services/business` -> `app/(public)/services/business/page.tsx`
    *   `/services/driver-network` -> `app/(public)/services/driver-network/page.tsx`
*   **Pricing Page**: `/services/pricing`
    *   *Handler File*: `app/(public)/services/pricing/page.tsx` (Renders `PricingCalculator.tsx`)
*   **Coverage Map/List**: `/coverage-areas`
    *   *Handler File*: `app/(public)/coverage-areas/page.tsx`
*   **Help Centre & FAQs**: `/faq`
    *   *Handler File*: `app/(public)/faq/page.tsx`
*   **Corporate & Legal Pages**:
    *   `/about` -> `app/(public)/about/page.tsx`
    *   `/contact` -> `app/(public)/contact/page.tsx`
    *   `/safety` -> `app/(public)/safety/page.tsx`
    *   `/terms` -> `app/(public)/terms/page.tsx`
    *   `/privacy-policy` -> `app/(public)/privacy-policy/page.tsx`
    *   `/cookie-policy` -> `app/(public)/cookie-policy/page.tsx`
    *   `/accessibility` -> `app/(public)/accessibility/page.tsx`

---

## 2. Authentication Routes

Authentication screens are grouped inside the `(auth)` folder. They share a centered branding layout.

*   **Sign In**: `/login`
    *   *Handler File*: `app/(auth)/login/page.tsx`
*   **Sign Up (Account Selection & Input)**: `/signup`
    *   *Handler File*: `app/(auth)/signup/page.tsx`
*   **OTP / SMS Code Verification**: `/verify-otp`
    *   *Handler File*: `app/(auth)/verify-otp/page.tsx`
*   **Reset Passwords**:
    *   `/forgot-password` -> `app/(auth)/forgot-password/page.tsx`
    *   `/reset-password` -> `app/(auth)/reset-password/page.tsx`
*   **Team Invitation Acceptance**: `/accept-invitation`
    *   *Handler File*: `app/(auth)/accept-invitation/page.tsx`
*   **Session Expired Notice**: `/session-expired`
    *   *Handler File*: `app/(auth)/session-expired/page.tsx`
*   **Account Locked Warning**: `/account-locked`
    *   *Handler File*: `app/(auth)/account-locked/page.tsx`
*   **Multi-Factor / Extra Verification**: `/security-verification`
    *   *Handler File*: `app/(auth)/security-verification/page.tsx`

---

## 3. Customer Dashboard Routes

Secure customer accounts are grouped under `(account)`. All pages render inside the `DashboardShell` to provide standard sidebar or bottom navigation.

*   **Dashboard / Activity Overview**: `/account`
    *   *Handler File*: `app/(account)/account/page.tsx`
*   **Delivery Order History**: `/account/orders`
    *   *Handler File*: `app/(account)/account/orders/page.tsx`
*   **Order Details & Live Progress**: `/account/orders/[id]`
    *   *Handler File*: `app/(account)/account/orders/[id]/page.tsx`
*   **Booking Request Wizard**: `/account/request-delivery`
    *   *Handler File*: `app/(account)/account/request-delivery/page.tsx` (Renders `DeliveryRequestForm.tsx`)
*   **Service-Specific Request Shells**:
    *   `/account/request-delivery/freight` -> `app/(account)/account/request-delivery/freight/page.tsx`
    *   `/account/request-delivery/moving` -> `app/(account)/account/request-delivery/moving/page.tsx`
    *   `/account/request-delivery/shuttle` -> `app/(account)/account/request-delivery/shuttle/page.tsx`
*   **Wallet Ledger, Deposits, Withdrawals**: `/account/wallet`
    *   *Handler File*: `app/(account)/account/wallet/page.tsx`
*   **Refund Submissions**: `/account/refunds`
    *   *Handler File*: `app/(account)/account/refunds/page.tsx`
*   **Address Management**: `/account/addresses`
    *   *Handler File*: `app/(account)/account/addresses/page.tsx`
*   **Profile, Security, Notification Preferences**: `/account/profile`
    *   *Handler File*: `app/(account)/account/profile/page.tsx`
*   **Support Ticket Center**: `/account/support`
    *   *Handler File*: `app/(account)/account/support/page.tsx`
*   **Membership & Plan Benefits (Presentation Shells)**:
    *   `/account/membership` -> `app/(account)/account/membership/page.tsx`
    *   `/account/membership/benefits` -> `app/(account)/account/membership/benefits/page.tsx`
    *   `/account/membership/invoices` -> `app/(account)/account/membership/invoices/page.tsx`
*   **Business Roster & Developer Keys**: `/account/business`
    *   *Handler File*: `app/(account)/account/business/page.tsx`
