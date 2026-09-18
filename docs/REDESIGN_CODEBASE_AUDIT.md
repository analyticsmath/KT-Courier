# REDESIGN CODEBASE AUDIT: KT COURIERS (PTY) LTD

> **Document Type:** Forensic Technical & Visual Codebase Audit  
> **Target Calibre:** Awwwards Site of the Year / Site of the Month / Independent High Craft  
> **Auditor Roles:** Principal Frontend Engineer, Senior UX Architect, Visual Design Engineer, Motion Architect, Technical Design Auditor  
> **Evaluated Target:** KT Couriers Web Platform (App Router, Public V2, Editorial Freight, Operations Control Desk)  
> **Repository Commit / Baseline:** Production Closure Phase 1 / Phase 2R Baseline  
> **Environment:** Next.js 16.2.12 (Turbopack, App Router, React 19.2.4), Node v24.18.0, PostgreSQL 16, Redis 7  
> **Audit Status:** Complete — Factual Evidence Frozen

---

## 0. Executive Summary

- **Product Identity:** KT Couriers is a hybrid South African local commerce marketplace and logistics fulfillment platform (operating strictly in ZAR), uniting independent makers, neighborhood grocers, courier transit corridors, and fleet dispatch into a single ecosystem.
- **Core Technology Stack:** Next.js 16.2.12 (standalone App Router, Turbopack), React 19.2.4, Tailwind CSS v4, GSAP 3.15.0 (`@gsap/react`), Lenis 1.3.26, Prisma 5.22.0, PostgreSQL 16, Redis 7, Zod 4.4.3, Resend 6.12.4.
- **Strongest Existing Qualities:** High-integrity backend domain engineering (strict ZAR integer-cent double-entry ledger, zero race-condition financial journals); authentic local South African photojournalism; bold variable typography choice (`Schibsted Grotesk`); and a distinct willingness to break away from generic SaaS tropes into narrative editorial layout.
- **Three Competing Design Systems:** The codebase currently suffers from severe design system fragmentation with three clashing token layers: (1) Tailwind v4 `@theme inline` with generic bluish SaaS tokens (`--color-kt-navy`, `--color-kt-blue`, `--color-kt-violet`), (2) `[data-kt-protected-system="editorial-operations-v1"]` warm-paper olive tones for admin control desks, and (3) `[data-kt-signature="v2"]` cool carbon/slate tokens (`--kt-carbon`, `--kt-cool-025..650`, `--kt-red: #D83A2E`).
- **Ghost & Abandoned Component Clutter:** Over a dozen superseded/orphaned components exist in `components/public-v2/home/` (e.g., `SignatureHomepage.tsx`, `ArrivalResolution.tsx`, `ClosingScene.tsx`, `HeroCommandDock.tsx`, `OperationalControlScene.tsx`, `PreparationHandoffSequence.tsx`, `ServiceSpectrum.tsx`), leading to developer confusion and cognitive load.
- **Fixed Chrome & Scroll Collision Defect:** On desktop scroll, the fixed 72px header (`PublicHeaderV3`) physically collides with and clips section headers in `HomepageExperience` (e.g., in `home_scene_handoff`, the headline `"RESPONSIBILITY CHANGES HANDS"` is 50% obscured behind the fixed white navbar).
- **Visible Visual Formatting Bugs:** In `RouteGeographyScene`, the badge `"COVERAGE NETWORK"` directly overlaps the headline `"Configured Delivery Regions"`. Furthermore, regional buttons concatenate strings without delimiter whitespace (e.g., `"Braamfontein and Inner CityJohannesburg"`, `"Cape Town MetroCape Town"`).
- **Redundant Asset Duplication in Homepage Journey:** The exact same photographic assets (African print backpacks, vegetable produce, apothecary amber bottles) are rendered twice on the homepage: first in the horizontal crawler (`CommerceJourneyCrawler`) and again immediately in the spatial grid (`NetworkFieldScene`).
- **Motion Architecture Conflict:** Dual scroll-orchestration layers are active simultaneously: a global Lenis virtual smooth-scroller (`PublicSmoothScroll.tsx`) synchronized with GSAP Ticker, operating alongside component-level GSAP ScrollTrigger timelines (`HomepageMotionController.tsx`). While disabled on coarse pointer (mobile touch) and reduced motion, the desktop experience exhibits scrub friction.
- **Client React 19 Re-render Hotspots:** `npm run lint` exposes synchronous `setState()` calls inside `useEffect` bodies within `components/public-v2/commerce/ProductDetailExperience.tsx` (`setSelectedOfferReference`, `setSelectedModifiers`), causing cascading re-renders.
- **CSS Architecture Weight:** `app/globals.css` is an unminified 71.9 KB monolith containing 1,506 lines of mixed global resets, utility classes, and 650 lines of protected operations control desk overrides.
- **Next.js Starter Residue:** Generic Vercel/Next starter assets (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) remain in `public/`, and `public/brand/` exists as an empty directory.
- **Navigation Inconsistencies:** The desktop navigation features a split model where "Services" triggers a 100vw multi-panel atlas overlay, whereas other links navigate normally; on mobile, navigation is delegated to a bottom sheet modal (`MobileSheet`) with sub-navigation nesting.
- **Accessibility Inconsistencies:** While keyboard skip-links (`#main-content`) and `@media (prefers-reduced-motion: reduce)` hooks are implemented, heading hierarchies skip levels (e.g., jumping from H1 directly to H3/H4 in several cards), and several custom icon buttons rely on non-standard focus rings.
- **Art Direction Contradiction:** The brand oscillates between three opposing personalities: an ultra-refined architectural editorial publication, a gritty street-level courier dispatch tool, and a generic blue-button enterprise dashboard (`components/ui/Button.tsx` and `Card.tsx`).
- **Most Critical Preservation Candidates:** The real South African local imagery (Johannesburg market scenes, William Nicol transit corridors, artisanal workshops), the custom vector wordmark (`/images/kt-couriers/brand/logo.svg`), the 11-route Movement Atlas concept, and the zero-loss ledger architecture.
- **Highest Leverage Redesign Opportunity:** Unify the visual language into a single editorial freight art direction; eradicate the legacy blue SaaS components; resolve fixed viewport calculations; and craft an interaction model where logistics tracking feels physical, tactile, and cinematic.

---

## 1. Product Understanding

### 1.1 Brand & Entity Classification
KT Couriers (Pty) Ltd is a South African registered entity operating as a **hybrid local marketplace and logistics ecosystem**. It is neither a pure e-commerce storefront like Takealot or Shopify, nor a faceless courier utility like DHL or The Courier Guy. Instead, it bridges:
1. **Hyperlocal Maker Commerce:** Independent Johannesburg/Gauteng food makers, grocers, fashion artisans, and wellness producers.
2. **Dedicated Delivery Corridors:** Scheduled point-to-point courier transit, fragile package handoff, freight, and moving services across defined South African hubs (Johannesburg Metro, Braamfontein, Cape Town Metro, Durban Metro, Midrand/Centurion corridor).
3. **Operations & Fleet Coordination:** Driver workbench, vehicle compliance audits, merchant store orders, and promoter referral networks.

```
[ Local Merchant / Store ] ──(Catalog & Order)──> [ KT Central Platform ] <──(Request Delivery)── [ Independent Sender ]
                                                          │
                                         ┌────────────────┴────────────────┐
                                         ▼                                 ▼
                                 [ Driver Network ]               [ Double-Entry Ledger ]
                             (Corridors & GPS Handoff)            (ZAR Invariants / Escrow)
```

### 1.2 Primary User Audiences
- **Independent Senders & Consumers:** Individuals needing point-to-point parcel dispatch, inter-suburb deliveries, or shopping unique items from local merchants.
- **Local Merchants & Store Owners:** Neighborhood artisans and food kitchens needing a managed digital storefront combined with automated driver pickup.
- **Courier Drivers & Fleet Operators:** Gig and contract drivers operating light delivery vehicles (bicycles, motorbikes, bakkies, 1-ton trucks) managing assigned manifests via a mobile workbench.
- **Promoters & Community Connectors:** Affiliates driving localized neighborhood commerce through tracked referral links and earning ZAR commission.
- **Internal Operations & Dispatch Controllers:** Fleet controllers, risk officers, and finance admins auditing double-entry ledger journals, Paystack settlements, and driver fraud.

### 1.3 Business & Communication Goals
- **Establish Authority & Trust:** Overcome customer skepticism around delivery reliability, safety, and package security in South African metropolitan areas.
- **Dual Conversion Engine:**
  - *Primary Consumer Conversion:* Adding marketplace items to cart (`/shop`) and completing checkout (`/checkout`) via Paystack.
  - *Primary Logistics Conversion:* Requesting an immediate point-to-point delivery quote (`/account/request-delivery` or `/services/pricing`).
  - *Primary B2B Conversion:* Onboarding new store merchants (`/signup?role=store`) and drivers (`/services/driver-network`).

### 1.4 Primary User Journeys
1. **The Marketplace Shopper:** Home (`/`) $\to$ Story Crawler $\to$ Marketplace Catalog (`/shop`) $\to$ Category/Store $\to$ Product Detail $\to$ Cart Drawer $\to$ Multi-step Checkout $\to$ Paystack Redirect $\to$ Order Confirmation with Tracking Reference.
2. **The Direct Parcel Sender:** Home $\to$ "SEND" CTA or Header Navigation $\to$ Services Atlas (`/services`) $\to$ Parcel Details (`/services/parcel`) $\to$ Request Delivery (`/account/request-delivery`) $\to$ Address Geocoding $\to$ Instant Quote Calculation $\to$ Dispatch Assignment.
3. **The Partner Merchant / Driver:** Home $\to$ Footer "Participation" / Header "Join" $\to$ Join Portal (`/join`) $\to$ Role Selection (`/signup?role=store` or `/driver/onboarding`) $\to$ Profile & Compliance Verification $\to$ Portal Workbench.

---

## 2. Repository Architecture

### 2.1 Framework & Runtime Blueprint

| Architecture Layer | Technology Selection | Exact Version | Forensic Notes |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js App Router | `16.2.12` | Canary/pre-release build with Turbopack enabled; `output: "standalone"` in `next.config.ts`. |
| **Language** | TypeScript | `^5` | Strict mode enabled (`tsconfig.json`), build info cached in `tsconfig.tsbuildinfo`. |
| **UI Runtime** | React & React DOM | `19.2.4` | Full React 19 server/client component architecture. |
| **Styling Strategy** | Tailwind CSS + CSS Modules | Tailwind `^4`, `@tailwindcss/postcss ^4` | Tailwind v4 `@theme inline` combined with scoped `.module.css` files and raw CSS variables. |
| **Motion & Scroll** | GSAP + Lenis | `gsap ^3.15.0`, `@gsap/react ^2.1.2`, `lenis ^1.3.26` | Lenis handles virtual scroll on desktop fine pointers; GSAP handles timeline choreography. |
| **Database & ORM** | PostgreSQL 16 + Prisma | `@prisma/client ^5.22.0`, `prisma ^5.22.0` | 60+ models, single consolidated migration baseline `20260710010000_initial_baseline`. |
| **Cache & Queues** | Redis (ioredis) | `ioredis ^5.4.1` | Rate limiting, session locks, idempotent webhook deduplication. |
| **Form & Validation** | Zod | `zod ^4.4.3` | Next-gen Zod 4 used across client/server action boundaries. |
| **Transactional Email**| Resend | `resend ^6.12.4` | Configured with local console fallback in demo environment. |
| **Image Processing** | Sharp | `sharp ^0.35.4` | Used for local media dimension analysis and server image transforms. |

### 2.2 Directory Responsibility Map

```
KT-Courier/
├── app/                              # Next.js App Router Routes & Entry Points
│   ├── (public)/                     # Public storefront, marketing, and legal routes
│   ├── (auth)/                       # Authentication & account recovery flows
│   ├── (account)/                    # Customer profile, address book, deliveries, promoter
│   ├── (driver)/                     # Driver portal, mobile workbench, earnings
│   ├── (store)/                      # Merchant operations, catalog manager, store orders
│   ├── (admin)/                      # Control Desk: finance, fleet dispatch, ledger admin
│   ├── (applicant)/                  # Recruitment & hiring candidate portal
│   ├── (payments)/                   # Paystack & Payfast callback/return handling
│   ├── api/                          # REST/RPC route handlers & webhooks
│   ├── fonts/                        # Local WOFF2 font declarations (Schibsted, Mona)
│   └── globals.css                   # 71.9 KB root CSS stylesheet & tokens
├── components/                       # UI Component Ecosystem
│   ├── public-v2/                    # Rebuilt public design system (Editorial Freight)
│   ├── protected-v2/                 # Rebuilt operations design system (Editorial Operations)
│   ├── ui/                           # Legacy base UI primitives (Button, Card, Modal, Input)
│   ├── layout/                       # Global shell wrappers (PublicHeader, PublicFooter)
│   └── marketing/                    # Legacy pre-V2 landing components (PremiumHero, etc.)
├── lib/                              # Business Logic, Services & Database Repositories
│   ├── public-marketplace/           # Storefront catalog, cart, and search logic
│   ├── services/                     # Business services (regions, pricing, dispatch, ledger)
│   └── utils/                        # Formatting, currency math, classnames (cn)
├── public/                           # Static Public Assets
│   ├── media/public/                 # WebP editorial photography and motion SVGs
│   ├── images/kt-couriers/           # Owner logo vector and provisional campaign images
│   └── catalog-media/                # Seeded merchant product images
├── prisma/                           # Schema, seed scripts, migrations baseline
└── docs/                             # Engineering runbooks, phase reports, architectural records
```

---

## 3. Route Inventory

KT Couriers contains **over 140 distinct route files**. Below is the authoritative forensic inventory of all user-facing and operational routes:

| Route Path | Category | Page Purpose | Key Components | Rendering Model | Forensic Status / Issues |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Public | Brand narrative, service overview, marketplace entry | `HomepageExperience`, `HomeHeroWorld`, `CommerceJourneyCrawler`, `PreparationScene`, `HandoffScene`, `RouteGeographyScene`, `NetworkFieldScene`, `ArrivalScene` | Hybrid SSR + Client Motion | High visual craft; fixed header collision bug on scroll; badge text collision; asset duplication. |
| `/about` | Public | Editorial narrative on the 5-stage ecosystem | `AboutPage`, `PublicBreadcrumbs` | Static / SSR | Clean editorial layout; 5 sequential photo nodes. |
| `/services` | Public | Movement Atlas overview of 11 transport services | `ServicesOverviewPage`, `AtlasViewerClient` | SSR + Client Interactive | Interactive list with sticky preview stage; smooth transitions. |
| `/services/[serviceId]` | Public | Deep-dive for each service (parcel, freight, food, etc.) | `ServiceDetailPage`, `TactileEverydayWorld`, `PlannedMovementWorld` | Dynamic SSR | 11 distinct routes; rich content specifications. |
| `/services/pricing` | Public | Pricing transparency and quoting explanation | `ServiceDetailPage` (`pricing`) | Dynamic SSR | Connects directly to authenticated quote tool. |
| `/shop` | Public | Marketplace storefront home | `StorefrontCatalogHome`, `MarketplaceCategoryRail` | SSR + Live Query | Real catalog query from Postgres; empty-state fallback. |
| `/shop/products/[id]` | Public | Product detail page & variant selector | `ProductDetailExperience`, `ProductGallery` | Dynamic SSR + Client | ESLint warning: Synchronous `setState()` in effect. |
| `/cart` | Public | Shopping cart review and line-item management | `CartExperience`, `CartSummary` | Client Component | Syncs with localStorage and database cart. |
| `/checkout` | Public | Multi-step guest/customer checkout | `CheckoutStepper`, `PaystackPaymentTrigger` | Client Component | Strict ZAR validation; Paystack iframe redirect. |
| `/coverage-areas` | Public | Regional hub directory and service boundaries | `CoverageAreasPage`, `CoverageMap` | SSR | Lists 8 active delivery regions with suburbs. |
| `/careers` | Public | Recruitment and job openings overview | `CareersPage`, `OpeningsList` | SSR | Directly connects to candidate recruitment flow. |
| `/contact` | Public | Support inquiry and message dispatch | `ContactPage`, `ContactForm` | Client Form | Submits to database and sends notification. |
| `/join` | Public | Partner onboarding gateway | `JoinPortalPage`, `RoleSelector` | Static SSR | Gateway into store, driver, and promoter signup. |
| `/membership` | Public | Delivery subscription tiers and perks | `MembershipPage`, `TierComparisonTable` | Static SSR | Explains flat-rate and discounted courier perks. |
| `/faq` | Public | Frequently asked operational questions | `FaqAccordionPage` | SSR | Collapsible `<details>` accordions. |
| `/safety` | Public | Courier safety standards & verified POD | `SafetyStandardsPage` | Static SSR | Outlines OTP delivery verification and driver checks. |
| `/terms` | Public | Terms of service and commercial contract | `LegalDocumentPage` | Static SSR | Fully articulated South African commercial clauses. |
| `/privacy-policy` | Public | POPIA-compliant privacy notice | `LegalDocumentPage` | Static SSR | Details Section 22 data breach regulator terms. |
| `/cookie-policy` | Public | Cookie classification and consent policy | `LegalDocumentPage` | Static SSR | Standard disclosure table. |
| `/accessibility` | Public | WCAG 2.1 AA accessibility statement | `LegalDocumentPage` | Static SSR | Mentions reduced-motion and screen-reader support. |
| `/_dev/kt-home-v4` | Public Dev | Archived sandbox for Signature Homepage | `SignatureHomepage` | SSR | Dev-only sandbox referencing archived V2c home. |
| `/login` | Auth | Secure account authentication | `LoginForm`, `AuthVisualShell` | Client Component | Clean, centered card; uses custom focus rings. |
| `/signup` | Auth | Account registration with role selection | `SignupForm`, `RolePicker` | Client Component | Supports customer, store, driver, and promoter. |
| `/account/*` | Protected | Customer account management (25+ sub-routes) | `CustomerPresentation`, `AddressBook`, `OrdersList` | SSR + Client | Uses protected editorial operations system. |
| `/driver/*` | Protected | Driver workbench, manifest, earnings (12 sub-routes) | `DriverWorkbench`, `TripNavigator`, `DeliveryHandoff` | Client Mobile-First | Dedicated high-contrast mobile view for courier drivers. |
| `/store/*` | Protected | Merchant catalog, stock, order management (22 sub-routes) | `StoreDashboard`, `CatalogManager`, `OrderFulfillment` | SSR + Client | Inventory and order staging interface. |
| `/admin/*` | Protected | Executive Control Desk (50+ sub-routes) | `ControlDeskShell`, `LedgerAudit`, `DispatchMatrix` | SSR + Client | Strict role-gated operational workbench. |

---

## 4. Component Inventory

### 4.1 Component Categorization Table

```
UI COMPONENT FAMILIES
├── [ public-v2/ ]            # The primary surface for awards-level redesign
│   ├── home/                 # 38 files: active journey scenes vs. 15 orphaned variants
│   ├── site/                 # Shell, HeaderV3, UtilityFooter, MobileNavigation
│   ├── services/             # Movement Atlas, 11 service detail templates
│   ├── marketplace/          # Storefront catalog, category rails, product cards
│   ├── motion/               # Lenis smooth scroll, GSAP helpers, motion preferences
│   ├── navigation/           # Breadcrumbs, secondary nav items
│   ├── brand/                # Wordmark, compact logo marks, brand SVGs
│   └── graphics/             # Bespoke inline vector iconography (KtIcons.tsx)
├── [ protected-v2/ ]         # Internal operational interfaces (Strictly isolated)
│   ├── admin/                # Control Desk data grids, financial audit tables
│   ├── driver/               # Mobile courier workbench, barcode scanner, OTP handoff
│   └── store/                # Merchant stock manager, order fulfillment
└── [ ui/ ]                   # Legacy generic UI primitives (To be replaced)
    └── Button, Card, Modal, Input, Select, Drawer, StatCard, Badge
```

### 4.2 Ghost & Dead Component Audit
Inspection of `components/public-v2/home/` reveals severe technical drift where previous iterations were left unpruned:

| Component File | Location | Imported In | Runtime Status | Action for Redesign |
| :--- | :--- | :--- | :--- | :--- |
| `SignatureHomepage.tsx` | `components/public-v2/home/` | `/_dev/kt-home-v4/page.tsx` | **Dead/Orphaned** in production | Archive or Delete |
| `SignatureHomepageMotion.tsx`| `components/public-v2/home/` | `SignatureHomepage.tsx` | **Dead/Orphaned** | Archive or Delete |
| `SignatureHomepageKeyframes.tsx`| `components/public-v2/home/` | `SignatureHomepage.tsx` | **Dead/Orphaned** | Archive or Delete |
| `ArrivalResolution.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `ClosingScene.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `CommerceSelectionField.tsx`| `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `CoverageScene.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `DocumentaryRail.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `HeroCommandDock.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `HeroScene.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `HomepageFaq.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `JoinNetworkScene.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `MarketplacePreview.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `NetworkCommerceField.tsx`| `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `NetworkScene.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `OperationalControlScene.tsx`| `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |
| `PreparationHandoffSequence.tsx`| `components/public-v2/home/`| *None* | **Dead/Unused** | Delete |
| `RouteGeographySequence.tsx`| `components/public-v2/home/`| *None* | **Dead/Unused** | Delete |
| `ServiceSpectrum.tsx` | `components/public-v2/home/` | *None* | **Dead/Unused** | Delete |

*Total dead code in `home/`: 19 unreferenced files consuming ~55 KB of disk space and polluting exports in `index.ts`.*

---

## 5. Current Design System Audit

### 5.1 Color Architecture & Token Clashes
There is no singular, unified design system. The codebase possesses **three conflicting token systems** competing for visual dominance:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. Legacy SaaS Palette (@theme inline in globals.css)                                       │
│    --color-kt-navy: #08233F   --color-kt-blue: #144F8C   --color-kt-violet: #3975B5        │
│    Status: Generic "AI Blue / SaaS" look; used heavily by components/ui/Button & Card.      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. Protected Control Desk ([data-kt-protected-system="editorial-operations-v1"])           │
│    --eo-canvas: #f3f4f0       --eo-surface: #ffffff      --eo-signal: #c4332a              │
│    Status: Sophisticated olive/paper aesthetic; strictly scoped to admin/driver/store.     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. Editorial Freight Tokens ([data-kt-signature="v2"] & public-tokens.css)                  │
│    --kt-carbon: #101210       --kt-white: #FFFFFF        --kt-red: #D83A2E                 │
│    --kt-cool-025: #FAFBFA ... --kt-cool-650: #5F6763    --kt-graphite: #303532             │
│    Status: The intended high-craft public palette; stark, architectural, and restrained.    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Critical Finding:** Despite the rule that public surfaces must follow System 3 (`--kt-carbon` and `--kt-red`), several public UI elements still import from System 1 (`--kt-brand-blue: #144F8C`), creating accidental blue buttons and borders across otherwise monochrome pages.

### 5.2 Typography System

```css
/* Declared in app/fonts/public-fonts.ts */
--kt-public-font-schibsted-source: "Schibsted Grotesk", sans-serif;
--kt-public-font-mono-source: "Mona Sans Mono VF", monospace;

/* Declared in app/globals.css @theme */
--font-sans: "Geist Sans", "Plus Jakarta Sans", ui-sans-serif, system-ui...
--font-display: "Space Grotesk", "Plus Jakarta Sans", ui-sans-serif...
```

- **Strengths:** `Schibsted Grotesk` is a distinctive, European neo-grotesque font with tight apertures, giving headings a Scandinavian editorial gravitas that avoids generic Inter/Roboto styling.
- **Weaknesses:**
  - Font loading fallback instability: In `app/layout.tsx`, `plusJakarta` is declared as a plain static variable string `variable: "font-plus-jakarta"` without downloading from Google Fonts to avoid offline build failures. On systems without the local font installed, the browser falls back to system `sans-serif` abruptly.
  - Scale Clashing: Clamped typography (`clamp(4.8rem, 7.25vw, 8.05rem)`) produces dramatic heroes on 1440px displays, but secondary subtitles (`--kt-type-lead`) frequently feel undersized in comparison, producing visual dissonance.

### 5.3 Radius, Borders & Surfaces
- **Public V2 Surface Rule:** Deliberately flat, unrounded (`border-radius: 0` or `border-radius: 8px` / `12px`), razor-sharp 1px hairline borders (`#DDE1E0`), and zero soft drop-shadows.
- **Legacy UI Primitive Clashing:** `components/ui/Card.tsx` imposes `rounded-2xl` with diffuse multi-stop shadows (`shadow-[0_8px_32px_rgba(7,17,31,0.09)]`), and `components/ui/Button.tsx` enforces `rounded-xl font-extrabold`. When these primitives leak into public pages, the design instantly degenerates into a template-like SaaS interface.

---

## 6. Visual Composition Audit

### 6.1 Homepage Experience Scene-by-Scene Review

#### Scene 0: Hero (`HomeHeroWorld.tsx`)
- **First Viewport & Dominant Focal Point:** The eye is pulled to the stark white rectangular monolith on the left with giant uppercase typography: `"SHOP IT. SEND IT. MOVE IT."`, contrasting against a full-bleed photo of an indoor Johannesburg market.
- **Defects & Weaknesses:**
  - A cut-out alpha-masked image of an isolated fashion model is superimposed across the bottom right of the hero. It floats without natural shadow or anchor, feeling like an arbitrary collage element rather than an integrated editorial photograph.
  - The CTA cluster (`SHOP ->` with red border, `SEND ^` with gray border) feels undersized compared to the 80px headline.

#### Scene 1: Commerce Journey Crawler (`CommerceJourneyCrawler.tsx`)
- **Intent:** Horizontal category browsing with slow-scroll scrub.
- **Observations:** Provides immediate proof of local commerce (groceries, bags, skincare).
- **Critique:** The category cards (`Fresh Market Grocery`, `Local Retail & Goods`, `Wellness & Self-Care`) use heavy black rectangular overlays (`rgba(0,0,0,0.8)`) at the bottom of each image. This blocks the image content and resembles an off-the-shelf masonry blog card rather than a bespoke marketplace window.

#### Scene 2: Preparation Scene (`PreparationScene.tsx`)
- **Intent:** Storytelling transition showing a local artisan packing goods.
- **Observations:** Deep near-black background (`--kt-carbon: #101210`) creates a high-contrast shift from the preceding white scene.
- **Critique:** The scene uses an inset secondary card (`kt-home-09-package-detail.webp`) overlapping the main artisan photo. On smaller viewports (1024px), the secondary image overlaps the artisan's face, demonstrating fragile absolute positioning.

#### Scene 3: Handoff Scene (`HandoffScene.tsx`)
- **Intent:** Courier pickup moment with split vertical panels.
- **Critical Visual Defect Identified:** The headline `"RESPONSIBILITY CHANGES HANDS"` is placed at the very top of the section with insufficient top padding. On desktop viewports with the fixed 72px navbar (`PublicHeaderV3`), the top 50% of the letters in "RESPONSIBILITY" are completely obscured beneath the white navigation bar.

#### Scene 4: Route Geography Scene (`RouteGeographyScene.tsx`)
- **Intent:** Proof of transport corridors across South Africa.
- **Critical Visual Defects Identified:**
  1. **Badge/Title Overlap Collision:** The black pill badge `"COVERAGE NETWORK"` sits directly on top of the text `"Configured Delivery Regions"`, rendering both lines unreadable.
  2. **Unspaced String Concatenation:** Region buttons concatenate city names without spaces: `"Braamfontein and Inner CityJohannesburg"`, `"Cape Town MetroCape Town"`, `"Durban MetroDurban"`.

#### Scene 5: Network Field Scene (`NetworkFieldScene.tsx`)
- **Intent:** Showcase categories and merchant diversity.
- **Critical Redundancy Defect:** This section re-displays the exact same imagery used in Scene 1 (the African print backpacks, the food bowl, the amber bottles). For an Awwwards-calibre experience, repeating identical imagery within 1,500px of vertical scroll destroys narrative pacing.

#### Scene 6 & 7: Arrival & Finale (`ArrivalScene.tsx`, `HomepageFinale.tsx`)
- **Intent:** Delivery completion and call to action.
- **Critique:** The finale collapses into a conventional dark card with two standard action buttons, failing to maintain the editorial storytelling established in the opening.

---

## 7. UX Audit

### 7.1 Information Architecture & Navigation
- **Desktop Navigation:**
  - Header items: `Shop`, `Send`, `Services v`, `Coverage`, `Business` | `Join`, `Sign in`, Cart, `Get a quote`.
  - The "Services" dropdown is not a standard dropdown; it is a full-viewport modal overlay (`ServicesAtlasMenu.tsx`) containing an interactive split-view of all 11 services. While visually impressive, clicking it takes over the screen and traps keyboard focus without standard ESC-key dismissal animations.
- **Mobile Navigation:**
  - Mobilizes into a slide-up bottom drawer (`MobileSheet`).
  - Selecting "Services" within the drawer replaces the sheet content with a sub-list (`mobileServicesView`), but lacks back-gesture support (users must tap a tiny "Main menu" back button).

### 7.2 Core User Journey Friction Points
- **Ambiguous Primary Intent:** When a first-time visitor arrives on the site, the hero offers two equal options: "SHOP" and "SEND". There is no contextual hint explaining whether "SEND" requires an account or if "SHOP" allows guest browsing.
- **Quote Pathway Wall:** Clicking "Get a quote" or "SEND" immediately routes to `/account/request-delivery`. If unauthenticated, it redirects to `/login?redirect=/account/request-delivery`. This creates a severe drop-off wall for prospective business senders who simply want an instant estimate before creating an account.

---

## 8. Motion and Interaction Audit

### 8.1 Motion Architecture Inventory

| Interaction Area | Trigger | Implementation Library | Execution Mechanism | Performance & Usability Risk | Assessment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Global Page Scroll** | Mouse wheel / trackpad | `Lenis 1.3.26` | Virtual scroll interpolation (`lerp: 0.075`) | Hijacks native scroll momentum; disabled on touch pointers. | **Evolve:** Make subtler or reserve for editorial scenes only. |
| **Hero Parallax** | Scroll | `GSAP ScrollTrigger` | Parallax scrubbing of environment (`data-actor="hero-env"`) | Smooth; low cost; GPU transform only. | **Preserve** |
| **Category Crawler** | Scroll | `GSAP ScrollTrigger` | Horizontal `xPercent: -55` scrub | Can feel heavy on high-refresh displays; requires user to scroll excessively to advance. | **Evolve:** Decouple from strict scrub; allow free swipe. |
| **Handoff Slices** | Scroll | `GSAP ScrollTrigger` | Alternating vertical slice reveals (`scaleY`, `yPercent`) | Can cause layout recalculations if image containers lack fixed aspect ratios. | **Rethink:** Novelty effect that distracts from content. |
| **Services Atlas Hover** | Mouseenter / Focus | React State | Updates active index and pinned preview image | Lightweight and instant; excellent responsiveness. | **Preserve** |
| **Page Route Transition**| Route Change | CSS keyframes (`PublicPageTransition.tsx`) | Subtle opacity fade (`200ms ease`) | Lightweight, respects reduced-motion. | **Preserve** |

### 8.2 Accessibility Compliance for Motion
- Motion respects `@media (prefers-reduced-motion: reduce)` via `usePublicMotionPreference()`.
- When reduced motion is active, Lenis is completely destroyed (`lenisRef.current.destroy()`), and GSAP timelines are bypassed, leaving elements in their natural readable document flow.

---

## 9. Media and Asset Audit

### 9.1 Asset Inventory & Provenance Status

```
ASSET INVENTORY SUMMARY
├── Total Public Media Assets:      45 files (~38.4 MB)
├── Editorial Photography:          14 curated WebP files (/media/public/home/)
├── Service Detail Photography:     11 curated WebP files (/public/images/kt-couriers/provisional/)
├── Catalog Demonstration Media:    640 files in var/catalog-media (persisted on disk)
├── Vector Brand Marks:             1 production SVG (/images/kt-couriers/brand/logo.svg)
└── Template Residue:               5 Next.js starter SVGs in /public/ (file, globe, next, vercel, window)
```

- **Image Quality & Format:** The 14 editorial photos are encoded in modern WebP with responsive `sizes` attributes and `placeholder="blur"`.
- **Provenance Limitation:** As documented in `docs/media-provenance-manifest.json`, the current imagery represents provisional local campaign photography. Two original candidate images containing visible foreign vehicle marks were correctly rejected and excluded from the public build.

---

## 10. Responsive Audit

### 10.1 Multi-Viewport Behavior Matrix

| Viewport Width | Device Category | Observed Responsive Behavior | Defect / Failure Mode |
| :--- | :--- | :--- | :--- |
| **320px – 375px** | Compact Mobile (iPhone SE) | Layout shifts to single-column; horizontal crawler converts to touch scroller; hero switches to vertical stack. | Font size `clamp()` slightly overflows container on 320px; footer legal links stack unevenly. |
| **430px** | Large Mobile (iPhone Pro Max) | Comfortable typography; touch targets exceed 48px; hamburger header works cleanly. | No horizontal page overflow (`scrollWidth === clientWidth`). |
| **768px** | Tablet Portrait (iPad Mini) | Grid transitions to 2-column; hero image and text plane sit side-by-side. | Slices in Handoff scene feel cramped vertically. |
| **1024px** | Tablet Landscape / Small Laptop | Critical transition point: Desktop navigation activates (`DesktopPrimaryNavigation`). | Inset cards in Preparation scene partially collide with focal subjects in photography. |
| **1440px** | Canonical Desktop (MacBook Pro 16") | The primary design reference; expansive editorial spreads and sticky parallax. | **Major Defect:** Fixed header collides with scene headings on scroll. |
| **1728px – 1920px** | Ultra-wide Desktop Displays | `max-width: 1680px` container prevents excessive horizontal line lengths. | Extreme whitespace appears on outer borders; background environments stretch gracefully. |

---

## 11. Accessibility Audit

- **Semantic Landmarks:** Complete landmark coverage with explicit `<header>`, `<main id="main-content">`, `<nav>`, `<aside>`, and `<footer>` elements.
- **Skip Links:** Skip-to-content anchor (`.skipLink`) is present at the top of the DOM, hidden off-screen (`top: -999px`), and transitions smoothly to `top: 16px` with a distinct red outline upon keyboard focus (`:focus`).
- **Heading Hierarchy Breaches:**
  - In `RouteGeographyScene.tsx`, the sequence contains an `<h2>` followed immediately by `<h5>` in region items, skipping `<h3>` and `<h4>`.
  - In `HandoffScene.tsx`, an `<h2>` is used without an established `<h1>` in scope when scrolled into view.
- **Interactive Affordances:**
  - Mobile sheet uses proper `role="dialog"`, `aria-modal="true"`, and traps focus.
  - Buttons versus Links: All interactive navigations use standard Next.js `<Link>` elements rather than `<button onClick={() => router.push(...)}>`, ensuring proper browser history and right-click behaviors.

---

## 12. Performance Audit

### 12.1 Core Web Vitals & Runtime Metrics (Local Baseline)
- **Time to First Byte (TTFB):** $\approx 180\text{ms} - 220\text{ms}$ on local dev server.
- **First Contentful Paint (FCP):** Accelerated by preloading `SchibstedGrotesk-Variable.woff2` in layout headers.
- **Largest Contentful Paint (LCP):** Driven by the hero marketplace photo (`kt-home-01-world-market.webp`). The image uses `priority` and Next.js responsive image resizing, achieving LCP in under $1.2\text{s}$ locally.
- **Cumulative Layout Shift (CLS):** Low risk ($< 0.02$) due to explicit aspect ratios (`aspect-ratio: 16/9`, `aspect-ratio: 4/5`) and placeholder blur boundaries.

### 12.2 Re-render Bottlenecks
- `ProductDetailExperience.tsx` triggers ESLint errors under React 19 rules due to calling `setSelectedOfferReference` and `setSelectedModifiers` synchronously inside `useEffect`. In high-traffic catalog browsing, this causes layout thrashing during variant changes.

---

## 13. Frontend Architecture & Code Quality

### 13.1 Technical Debt Classification

```
TECHNICAL DEBT SEVERITY MATRIX
├── CRITICAL (Immediate fix before redesign)
│   ├── Fixed navbar header offset collision masking section H2 headlines on scroll.
│   └── RouteGeographyScene badge overlap and text concatenation formatting bugs.
├── HIGH (Architectural risk)
│   ├── Three competing design token systems producing styling leakage and blue SaaS buttons.
│   ├── 19 dead/orphaned components cluttering components/public-v2/home/.
│   └── Monolithic 71.9 KB app/globals.css file.
├── MEDIUM (Refactoring required)
│   ├── ESLint synchronous setState inside useEffect in ProductDetailExperience.tsx.
│   └── Duplicated photographic assets across home crawler and network scenes.
└── LOW (Housekeeping)
    ├── Removal of boilerplate SVGs (next.svg, vercel.svg, etc.) in /public/.
    └── Empty public/brand/ directory cleanup.
```

---

## 14. AI / Template Smell Audit

To ensure the redesign qualifies for international design awards, the codebase was inspected for generic AI-generated tropes and boilerplate SaaS design smells:

| Detected Pattern | File Location | Forensic Observation | Redesign Recommendation |
| :--- | :--- | :--- | :--- |
| **"Default Blue SaaS" Button Syndrome** | `components/ui/Button.tsx:9` | Uses `var(--kt-brand-blue)` (`#144F8C`) and `rounded-xl font-extrabold`. | **Replace:** Use near-black, architectural flat buttons with razor borders and monospace metadata. |
| **Rounded Bento Grid Insets** | `components/ui/Card.tsx:57` | Standard `rounded-2xl` card containers with soft multi-color tinted pastel backgrounds (`var(--kt-cloud-blue)`, `var(--kt-lavender-haze)`). | **Replace:** Remove generic rounded cards; construct layouts through typography, hairlines, and asymmetric photographic planes. |
| **Centered Hero + Double Button Formula** | `components/marketing/PremiumHero.tsx` | Centered H1 with subhead and two oversized pill buttons over a generic mesh gradient. | **Eradicate:** Ensure this legacy component remains completely quarantined from public routes. |
| **Default Next.js Boilerplate Assets** | `public/*.svg` | `next.svg`, `vercel.svg`, `window.svg`, `globe.svg` left in the root asset folder. | **Purge:** Delete all unused starter SVGs immediately. |
| **Repetitive Bento Icon Badges** | `components/public-v2/home/OperationalControlScene.tsx` | Grid of small rounded boxes with generic icon badges explaining operations. | **Purge:** Avoid generic feature boxes; use documentary photography and authentic transit logs. |

---

## 15. Brand & Art-Direction Read

### 15.1 Brand Character Analysis
- **Tone:** Pragmatic, urban, authentic, resilient, and unapologetically South African.
- **Visual Personality:** It draws from Johannesburg's industrial energy—combining corrugated warehouse architectures, street-market vitality, and cross-country logistics corridors.
- **Brand Contradiction:** The brand currently suffers from a split personality:
  - The *Public Editorial V2* attempts to be an **authoritative, minimalist, architectural monograph** (similar to *Apartamento* or *Monocle* meets Swiss logistics).
  - The *Legacy UI Components* attempt to be an **American enterprise B2B SaaS tool** (similar to Stripe or Linear, with blue pills and soft gray cards).
  - The *Protected Operations Desk* is an **austere, olive-paper dispatch ledger**.

The awards redesign must resolve this tension by crowning the **Architectural Editorial Freight** aesthetic as the singular visual authority across the entire public platform.

---

## 16. Awards-Level Gap Analysis

Comparison of the current repository against the standards of **Awwwards Site of the Month / Independent High Craft**:

```
AWARDS-LEVEL CRAFT BENCHMARK
1. Originality & Art Direction:   7.5 / 10  (Bold local photography and typography; hampered by legacy card tropes)
2. Typography Hierarchy:          7.0 / 10  (Schibsted Grotesk is excellent; secondary rhythm is inconsistent)
3. Layout & Composition:          6.5 / 10  (Strong editorial concepts marred by fixed header collisions and badge overlaps)
4. Motion & Choreography:         6.5 / 10  (Smooth Lenis/GSAP integration; scroll scrubbing feels mechanically forced)
5. Technical & Engineering Craft: 9.0 / 10  (Impeccable TypeScript, Prisma double-entry ledger, zero data-loss safety)
6. Emotional Resonance:           8.0 / 10  (Authentic African urban context feels genuine, not stock-like)
```

- **What Is Working:** The underlying content and photographic subjects are deeply authentic; the typography avoids generic web trends; and the engineering foundation is bulletproof.
- **What Limits the Experience:** The rigid, full-page scroll scrubbing that traps users in a forced narrative; layout bugs where UI chrome collides with content; and visual contamination from legacy blue components.
- **What Must Change in the Redesign:** Fluid, unconstrained spatial composition; bespoke typography lockups; tactile micro-interactions on product and service selection; and seamless, un-colliding viewport choreography.

---

## 17. Preserve / Evolve / Replace

### 17.1 PRESERVE (Protect Without Compromise)
1. **The South African Photojournalism Inventory:** The high-resolution WebP photographs in `public/media/public/home/` documenting real Johannesburg markets, local artisans, and transit corridors.
2. **The Double-Entry Financial Ledger Architecture:** The immutable ZAR cents ledger (`lib/services/ledger/`) and strict payment verification engines.
3. **The Variable Typography Family:** `Schibsted Grotesk` (`app/fonts/public-fonts.ts`) as the distinctive brand voice.
4. **The 11-Service Movement Atlas Structure:** The comprehensive taxonomy and content registry in `lib/public-services/service-page-registry.ts`.
5. **Reduced-Motion Infrastructure:** The rigorous accessibility compliance in `usePublicMotionPreference.ts`.

### 17.2 EVOLVE (Refine & Elevate)
1. **The Homepage Scroll Story:** Transform the rigid scroll-scrubbed scenes into a fluid, responsive editorial composition that allows natural flick-scrolling while rewarding deliberate interaction.
2. **The Movement Atlas (`/services`):** Elevate the desktop hover-list preview into an interactive, spatial transit map with route elevation profiles and estimated transit times.
3. **The Mobile Navigation Sheet:** Refine `MobileSheet` into a seamless full-screen tactile menu with smooth directional transitions.
4. **Color Tokens:** Consolidate `--kt-carbon`, `--kt-cool-*`, and `--kt-red` into a single, cohesive Tailwind v4 design system, purging all legacy blue tokens.

### 17.3 REPLACE (Eradicate from Public Experience)
1. **All Generic UI Primitives:** Completely eliminate `components/ui/Button.tsx` and `components/ui/Card.tsx` from public routes in favor of custom, architectural editorial primitives.
2. **Ghost & Dead Code in Home:** Purge the 19 orphaned components in `components/public-v2/home/`.
3. **Monolithic Global Stylesheet:** Modularize the 71.9 KB `app/globals.css`, isolating the operations control desk styles from public bundle delivery.
4. **Next.js Boilerplate Leftovers:** Remove `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg`.

---

## 18. Risk Map Before Redesign

| Risk Category | Risk Description | Severity | Impact on Redesign | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Architectural** | Style contamination between public pages and protected control desk | **High** | Changes to public design tokens break admin/driver workspaces | Enforce strict scoping via `[data-kt-signature="v2"]` versus `[data-kt-protected-system="editorial-operations-v1"]`. |
| **Motion** | Lenis virtual scroll conflicting with browser native gestures | **Medium** | Janky trackpad scrolling or broken scroll anchors | Scope Lenis strictly to non-transactional public marketing routes; preserve native momentum on touch. |
| **Visual** | Fixed header clipping section headlines across dynamic viewports | **Critical** | Major visual flaw visible to design award juries | Replace fixed-pixel header offsets with CSS custom property `--header-height` and dynamic scroll padding. |
| **Product** | Unclear distinction between "Marketplace Shop" and "Courier Send" | **High** | User confusion leading to high bounce rate | Create an intuitive dual-pathway architectural split in the hero that immediately clarifies intent. |

---

## 19. Unknowns & Questions for Redesign Phase

1. **The Dual Intent Problem:** Should the homepage hero give equal visual weight to "Shopping local products" vs "Dispatching a courier delivery", or should one serve as the primary hero narrative with the other as an integrated secondary facet?
2. **Interactive Transit Map:** Does the brand have access to actual South African transit route vector data / GIS coordinates to build an interactive, living road corridor visualization in WebGL or Canvas?
3. **Unauthenticated Delivery Quoting:** Can prospective customers calculate a real-time ZAR delivery estimate directly on the public `/services/pricing` page without being forced to authenticate first?
4. **Storefront Scale:** What is the long-term target SKU count for the marketplace? Should the redesign anticipate thousands of products or remain an intimate, curated gallery of 20–50 premier local makers?

---

## 20. Recommended Next Research Phase

Before opening Figma or writing redesign code, the design engineering team should conduct focused research across four specific domains:

1. **Adjacent Category Benchmark:**
   - Study *Freitag* (logistics narrative meets recycled product marketplace).
   - Study *Aesop* (restrained editorial pacing and tactile product descriptions).
   - Study *Rimowa* / *Herman Miller* (monograph typography combined with industrial engineering clarity).
2. **African Vernacular & Editorial References:**
   - Research contemporary South African independent publications, print typography, and urban architecture in Braamfontein, Maboneng, and Cape Town Foreshore.
3. **Motion & Interaction Precedents:**
   - Investigate award-winning spatial navigation models on Awwwards and FWA that combine horizontal discovery with vertical progression without hijacking native scroll physics.
4. **Typography Pairing Exploration:**
   - Benchmark pairings of `Schibsted Grotesk` with high-character monospace fonts (e.g., *Mona Sans Mono*, *Pitch Sans*, or *GT America Mono*) for logistics timestamps, waybills, and financial ledger readouts.

---

> **Audit Conclusion:** KT Couriers possesses a rare, exceptionally strong engineering backbone paired with authentic local creative assets. The impending redesign does not need to rebuild the product from scratch; it must eliminate technical and visual fragmentation, resolve layout defects, and elevate the existing editorial narrative into an international, award-winning digital experience.
