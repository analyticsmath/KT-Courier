# Phase 30A — Design System

This document specifies the core styling system, visual tokens, theme colors, typography rules, border-radius constants, shadow hierarchies, and micro-animations for KT Couriers.

---

## 1. Color Palette

KT Couriers uses CSS custom properties declared inside `app/globals.css`. These colors map directly to South African logistics styling, providing high contrast and premium aesthetics.

### Primary and Background Colors
*   **Canvas/Background**: `var(--kt-bg-canvas)` (`#F8FAFC`) — A clean, light slate-tinted canvas to prevent eye fatigue.
*   **Surface**: `var(--kt-bg-surface)` (`#FFFFFF`) — pure white container surfaces.
*   **Brand Navy (Primary)**: `var(--kt-navy)` (`#07111F`) — A deep midnight indigo-black used for primary text, branding, and major headers.
*   **Soft Border**: `var(--kt-soft-border)` (`#D8DEE8`) — Subtle, accessible borders for dividers, cards, and input boundaries.

### Accent and Status Colors
*   **Brand Blue (Signal Cobalt)**: `var(--kt-signal-cobalt)` (`#2563EB`) — Primary action color, link color, and customer-themed elements.
*   **Hover Indigo**: `var(--kt-digital-indigo)` (`#4F46E5`) — Secondary brand action, hover states, and business-themed elements.
*   **Movement Accent (Copper Flame)**: `var(--kt-copper-flame)` (`#C05621`) — Orange warning banners, active transit icons, and driver-themed elements.
*   **Mint/Teal (Success)**: `var(--kt-mint-wash)` (`#ECFDF5`) / `var(--kt-teal-emerald)` (`#059669`) — Used for completed orders, approved transactions, and success alerts.
*   **Red (Destructive)**: `var(--kt-red-soft)` (`#FEF2F2`) / `var(--kt-red)` (`#DC2626`) — Used for validation errors, cancelled deliveries, and critical connectivity alerts.

---

## 2. Typography

*   **Primary Font**: `Plus Jakarta Sans` — Loaded via google fonts and used for headers, numbers, and primary UI copy to give a modern, premium feel.
*   **Fallback Font**: `Geist Sans` or `system-ui`.
*   **Mono Font**: `JetBrains Mono` or `monospace` — Used for tracking numbers, waybill references, database keys, and transaction currencies.
*   **Headings**: Bold/Black display font weight (`font-black`) with precise line heights to prevent wrapping overlap.
*   **Body Copy**: Regular or medium weights (`font-medium`) with letter-spacing improvements.

---

## 3. Spacing & Borders

*   **Grid Gaps**: Standardized on a 4px base grid (`gap-4`, `gap-5`, `gap-6` etc.).
*   **Border Radius**:
    *   `sm`: `12px` (used for small buttons, checkboxes, input controls).
    *   `md`: `18px` (used for standard cards, lists, select dropdowns).
    *   `lg`: `28px` (used for modals, hero sections, desktop drawers).
    *   `xl`: `36px` (used for large banners and marketing wrappers).
*   **Shadows**: Subtle shadows with alpha channels to prevent looking muddy.
    *   `shadow-sm`: `0 1px 3px rgba(7, 17, 31, 0.05)`
    *   `shadow-md`: `0 4px 16px rgba(7, 17, 31, 0.08)`
    *   `shadow-lg`: `0 10px 32px rgba(7, 17, 31, 0.12)`

---

## 4. UI/UX Micro-Animations

*   **State Transitions**: All interactive elements (hover, focus, active states) use transitions with ease-in-out timing:
    `transition-all duration-150 ease-in-out`
*   **Hover Scale**: Buttons and clickable cards use subtle hover transformations to feel highly responsive:
    `hover:shadow-md hover:-translate-y-0.5`
*   **Active States**: Buttons shrink slightly on press (`active:scale-[0.98]`) to provide immediate tactile screen feedback.
*   **Alert Pulse**: Critical alert badges (e.g. offline connectivity errors) use high-duration pulse cycles to capture attention without causing visual distraction.
