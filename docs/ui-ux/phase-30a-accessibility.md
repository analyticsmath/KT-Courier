# Phase 30A — Accessibility (a11y) Design Document

This document lists the mechanisms implemented toward WCAG 2.2 AA (runtime browser, keyboard, zoom, screen-reader and contrast validation remains required) across all 110 contexts in KT Couriers, detailing screen-reader adaptations, keyboard navigation pathways, and color contracts.

---

## 1. Landmark Structures & Heading Outline

*   **Aria Landmarks**: Every page rendered in Next.js uses strict HTML5 structural landmarks:
    *   `<header>`: Application top headers, navigation headers, logo links.
    *   `<nav>`: Left desktop sidebar and mobile bottom navigation bars.
    *   `<aside>`: Modal dialog drawers or floating utility sheets.
    *   `<main>`: Primary content container. Matches ID `main-content` for the skip link.
    *   `<footer>`: Marketing page footers and corporate licensing statements.
*   **Heading Hierarchy**: Pages are limited to a single `<h1>` tag representing the screen title. Sub-sections use sequential `<h2>`, `<h3>`, and `<h4>` structures. Custom typography sizes are decoupled from structural HTML elements to prevent skipping hierarchy levels.

---

## 2. Keyboard Navigation & Focus Controls

*   **Skip Link**: A skip-to-content anchor is included at the top of the root layout (`app/layout.tsx`). It is hidden off-screen by default and becomes visible on focus:
    `focus:translate-y-0 focus:opacity-100`
    This shifts focus straight to `#main-content`, bypassing the top header and side navigation.
*   **Focus Ring Indicators**: Focus indicators are styled explicitly across all interactive buttons, inputs, and anchors using a consistent ring accent:
    `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kt-signal-cobalt)]`
*   **Modal Focus Trap**: All modal dialogs and bottom sheets (e.g. `AddressForm.tsx` modals) capture keyboard focus on open. Pressing `Tab` cycles exclusively through modal inputs, and pressing `Escape` closes the panel, returning focus to the element that triggered it.

---

## 3. Screen Reader Adaptations

*   **Explicit Labels**: Inputs and action buttons use explicit visual labels (`<Label htmlFor="...">`) rather than placeholders. Icons (e.g. status svg icons) use `aria-hidden="true"` to prevent raw character recitation.
*   **Dynamic Announcements**: Form submission outcomes, network connection changes, and shopping cart updates use dynamic alerts:
    *   `OfflineBanner.tsx` uses `role="status"` and `aria-live="polite"` to alert users without interrupting flow.
    *   Quantity changes in the marketplace cart use `aria-live="polite"` inside live summary cards.
*   **Form Errors**: Validation errors list their issues explicitly below the input box using a matching ID:
    `<Input aria-invalid={!!error} aria-describedby="field-error-id" />`
    `<p id="field-error-id" role="alert" className="text-[var(--kt-red)]">Error details...</p>`

---

## 4. Visual Contrast & Accessibility Options

*   **Contrast Ratios**: Body text satisfies WCAG AA contrast rules (minimum 4.5:1 ratio). Critical notifications use thick background washes and solid dark text color pairings rather than thin borders or pastels.
*   **Reduced Motion**: Animation effects (e.g. pulsing warnings, slide-in drawers, fading overlays) respect user settings:
    `motion-safe:animate-pulse` or `transition-transform motion-reduce:transition-none`
*   **Responsive Target Clearance**: Action buttons and interactive controls have a minimum touch target size of `48px x 48px`. On mobile screens, pages include a bottom spacing offset of `pb-24` to prevent overlap with the persistent bottom navigation bar.
