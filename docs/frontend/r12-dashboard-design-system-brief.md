# KT Couriers Phase R12 — Editorial Operations Design System Specification

> **Audit Context**: Protected Application Design System Specifications  
> **System Name**: Editorial Operations (Protected Extension of Editorial Freight)  
> **Implementation Scope**: Candidate Token Specifications for Phase R13+

---

## 1. Design System Overview & Architecture

Editorial Operations is the application-side continuation of the public Editorial Freight design identity. Where the public website is cinematic and image-driven, Editorial Operations is dense, quiet, structured, information-rich, and permission-aware.

---

## 2. Color Palette & Token Architecture

### 2.1 Proposed Canvas & Surface Tokens
- `--kt-op-bg-canvas`: `#ffffff` (Pure White Application Canvas)
- `--kt-op-bg-surface-subtle`: `#f8fafc` (Cool Mineral Near-White)
- `--kt-op-bg-surface-elevated`: `#ffffff` (Card & Rail Surfaces)
- `--kt-op-bg-surface-hover`: `#f1f5f9` (Interactive Hover Surface)
- `--kt-op-border-subtle`: `#e2e8f0` (Subtle Mineral Border)
- `--kt-op-border-strong`: `#cbd5e1` (Focus & Divider Border)

### 2.2 Typography & Text Tokens
- `--kt-op-text-primary`: `#0f172a` (Carbon Primary Text)
- `--kt-op-text-secondary`: `#475569` (Graphite Secondary Text)
- `--kt-op-text-muted`: `#64748b` (Muted Helper Text)
- `--kt-op-text-disabled`: `#94a3b8` (Disabled Text)

### 2.3 Signal & Accent Tokens
- `--kt-op-signal-oxide`: `#c92a2a` (Oxide Red Brand Signal / Primary Action Accent)
- `--kt-op-accent-teal`: `#0e7490` (Deep Mineral Teal Operational Accent)
- `--kt-op-surface-dark`: `#0f172a` (Near-Black Dark Surface Contrast)

### 2.4 Semantic State Indicators
- **Success**: Text `#15803d`, Tint `#f0fdf4`, Border `#bbf7d0`
- **Warning**: Text `#b45309`, Tint `#fffbeb`, Border `#fde68a`
- **Danger**: Text `#b91c1c`, Tint `#fef2f2`, Border `#fecaca`
- **Info / Neutral**: Text `#0369a1`, Tint `#f0f9ff`, Border `#bae6fd`

---

## 3. Typography & Density Guidelines

### 3.1 Font Stack Integration
- **Headings & Titles**: `var(--font-mona-sans)` (Mona Sans, variable font)
- **Body & Data Tables**: `var(--font-mona-sans)` with tabular numbers (`font-variant-numeric: tabular-nums`)
- **Editorial Accents & Quotes**: `var(--font-newsreader)` (Newsreader, italic serif)

### 3.2 Font Scale & Line Heights
- `text-xs`: 0.75rem (12px), Line Height 1.25 (Tabular data, metadata badges)
- `text-sm`: 0.875rem (14px), Line Height 1.35 (Table body text, form input text)
- `text-base`: 1.0rem (16px), Line Height 1.5 (Primary body text, card headers)
- `text-lg`: 1.125rem (18px), Line Height 1.4 (Section titles, KPI numbers)
- `text-xl`: 1.25rem (20px), Line Height 1.3 (Page section titles)
- `text-2xl`: 1.5rem (24px), Line Height 1.2 (Main Page Headers)

---

## 4. Card Taxonomy & Layout Structure

### 4.1 Controlled Card Families
1. **Metric Tile**: Displays single source-backed metric, label, and explicit comparison timeframe.
2. **Operational Panel**: Workspace card housing primary queues, tables, or active delivery maps.
3. **Record Summary**: Entity identity card (Order, Driver, Store) with state badge and primary actions.
4. **Context Panel**: Right-rail card showing recent audit activity, notes, or agenda items.
5. **Insight Panel**: Card hosting a single decision-focused chart with textual summary.
6. **Action Panel**: Prominent card highlighting a single required operational step.
7. **Illustration Panel**: Empty, locked, onboarding, or error state container.
8. **Financial Summary**: Dual-control financial status card with ledger reference and amounts.
9. **Timeline Panel**: Chronological status progression card.

---

## 5. Responsive System & Breakpoint Strategy

- **Compact (320px – 599px)**: Mobile viewports. Single-column stacked cards, bottom navigation bar for Customer/Driver, full-screen detail routes instead of drawers.
- **Medium (600px – 1023px)**: Tablet viewports. Collapsible sidebar, 2-column grid cards, condensed tables with priority columns.
- **Expanded (1024px – 1439px)**: Desktop viewports. Fixed navigation rail, 12-column grid, split list-detail workspaces.
- **Wide (1440px+)**: Large monitors. Maximum container width capped at 1440px, right-hand contextual rail fully expanded.
