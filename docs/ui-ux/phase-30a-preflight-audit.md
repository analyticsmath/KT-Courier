# Phase 30A — Preflight Audit

This document establishes the frontend architecture, styling tokens, route inventory, asset status, and integration plans for KT Couriers Phase 30A.

## 1. Repository Architecture
KT Couriers is a Next.js project using the App Router with Route Groups separating public marketing, user authentication, customer accounts, store portals, and administrative views.
- **Root Directory Structure**:
  - `app/`: Route directory containing all pages, layouts, and API routes.
  - `components/`: UI, layout, marketing, and domain-specific presentational components.
  - `lib/`: Domain business logic, database client, auth utilities, and services.
  - `docs/`: Phase plans, architecture notes, and developer guides.
  - `public/`: Static files including logos, illustrations, and optimized WebP images.
  - `tests/`: Component, integration, and E2E test suites.

## 2. Current Frontend Stack
- **Framework**: Next.js `16.2.9` (React `19.2.4`) utilizing Server Components, Client Components, and dynamic layouts.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss` and `tailwindcss` version `^4`) using css-variable theme loading.
- **Icons**: Outlined inline SVGs are preferred to maintain a minimal, dependency-free bundle.
- **Validation**: Zod client/server schema validation.
- **Orm/Database**: Prisma ORM with PostgreSQL backend.

## 3. Existing Visual Foundations
The visual styles are managed via CSS Custom Properties in `app/globals.css` with `@theme inline` mapping:
- **Canvas/BG**: `#F8FAFC`
- **Surface**: `#FFFFFF`
- **Border**: `#D8DEE8`
- **Text**: `#111827`
- **Brand Navy (Primary)**: `#07111F`
- **Brand Blue (Accent)**: `#2563EB` (Hover: `#4F46E5`, Soft: `#EAF2FF`)
- **Signal Orange (Movement Accent)**: `#C05621` (Copper Flame)
- **Typography**: "Plus Jakarta Sans" for typography. Geist Sans and Space Grotesk are loaded as secondary fallbacks or will be integrated in Phase 30A.
- **Border Radius**: 12px (sm) / 18px (md) / 28px (lg) / 36px (xl)

## 4. Reusable Components
The directory `components/ui/` has high-quality core components:
- `Badge.tsx`: Visual status indicators (OrderStatusBadge).
- `Button.tsx`: Composable action triggers (ghost, primary, secondary variants).
- `Card.tsx`: Content cards with custom borders and shadows.
- `DataTable.tsx`: Server/client-side data rendering.
- `Drawer.tsx` / `Modal.tsx`: Layered sheets and modal overlays.
- `EmptyState.tsx` / `ErrorPanel.tsx`: Non-happy-path feedback.
- `Input.tsx` / `Label.tsx` / `Select.tsx` / `Textarea.tsx`: Custom form input controls.
- `LoadingSkeleton.tsx`: Content skeletons during async fetching.
- `PageHeader.tsx`: Structured top-level title and description.
- `StatCard.tsx`: Numerical KPIs.

## 5. Conflicting Legacy Patterns
- **Layout Flashing**: Customer sidebar layout hides when switching to small screens, but is not yet fully optimized for modern app-like bottom navigation.
- **Placeholder Pages**: Several sub-pages under `/account` are either basic heading pages or stubbed forms.
- **Typography Consistency**: Some page titles use custom headings instead of importing the standard `PageHeader` component.
- **Hex Code Duplication**: Inline classes like `bg-red-50` exist on some routes and should be migrated to CSS custom variables (e.g. `var(--kt-red-soft)`).

## 6. Current Route Inventory
- **Public Site**:
  - `/` (Home)
  - `/services` (Services overview)
  - `/about` (About KT Couriers)
  - `/contact` (Contact form)
  - `/faq` (Help and FAQs)
  - `/coverage-areas` (Region maps/lists)
  - `/privacy-policy` (Privacy details)
  - `/terms` (Terms of service)
- **Authentication**:
  - `/login` (Login screen)
  - `/signup` (Sign up with customer/store selection toggle)
  - `/verify-otp` (One-time pin verification)
  - `/forgot-password` (Trigger reset)
  - `/reset-password` (New password entry)
- **Customer Account**:
  - `/account` (Dashboard overview)
  - `/account/orders` (Deliveries list)
  - `/account/orders/[id]` (Order details)
  - `/account/wallet` (Transactions & wallet balance)
  - `/account/refunds` (Refund requests)
  - `/account/addresses` (Saved address book)
  - `/account/profile` (Profile configurations)
  - `/account/support` (Support ticketing)
  - `/account/request-delivery` (Step-by-step parcel booking)
- **Marketplace**:
  - `/shop` (Marketplace home)
  - `/shop/categories` (Category browsing)
  - `/shop/products/[product]` (Product detail view)
  - `/shop/stores` (Storefront listings)

## 7. Existing Assets
The directory `public/images/kt-couriers/` contains nine optimized WebP assets:
- `box-sealing-order-prep.webp`
- `cape-town-city-route.webp`
- `cape-town-street-view.webp`
- `hands-exchanging-delivery-packages.webp`
- `labelled-parcel-preparation.webp`
- `parcel-handoff-customer.webp`
- `parcel-packing-close-up.webp`
- `small-business-delivery-counter.webp`
- `store-merchandise-packing.webp`

## 8. Missing Assets
- **Instructional Diagrams**: Visual representations of parcel size boxes (Small/Medium/Large/Extra Large), packaging types, and address pin confirmation flows. These will be implemented using code-generated inline SVGs rather than hotlinking remote files.
- **Category Tiles**: Graphics for marketplace catalog categories (Food, Grocery, Pharmacy, E-Commerce). Code-generated SVGs with curated icons will serve as high-fidelity visual representations.

## 9. Dependency Constraints
- **React version**: `19.2.4` (React Server Components active).
- **Tailwind version**: `^4.0.0` (postcss-based theme parsing, no separate tailwind config file).
- **Resource Policy**: Zero package additions or external downloads. We will use existing framework configurations and CSS layers.

## 10. Implementation Decisions
- **Unified Responsive Navigation**: Replace the full desktop sidebar drawer on compact viewports with a persistent mobile bottom navigation bar (`Home`, `Shop`, `Orders`, `Wallet`, `Account`) and a mobile top app bar.
- **South African Localization**: Hardcode South African data context (`ZAR`, `R`, `km`, `kg`, `Africa/Johannesburg` timezone, South African cities/provinces) across all forms, tables, and mockup cards.
- **Workflow State Management**: Share workflow components and DTO validation rules across both desktop and mobile viewports. Layouts will adapt via Tailwind breakpoint classes (`sm:`, `md:`, `lg:`, `xl:`), keeping business logic unified in Next.js Server Actions and standard APIs.

## 11. Protected Backend Boundaries
The following files and logic layers will not be edited during this frontend design implementation:
- Prisma Schema (`prisma/schema.prisma`)
- Database migrations and seeds
- Ledger calculations and payment providers (`lib/payments/`, `lib/ledger/`)
- User session authentication database tokens (`lib/auth/session.ts`)
- Commission calculations (`lib/commissions/`)
