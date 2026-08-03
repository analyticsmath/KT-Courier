# Phase 30A — Responsive Layout Contract

This document outlines the responsive grid system, screen size thresholds, navigation adaptations, and viewport clearance contracts implemented toward WCAG 2.2 AA (runtime browser, keyboard, zoom, screen-reader and contrast validation remains required) to guarantee layout consistency across mobile, tablet, and desktop devices.

---

## 1. Breakpoint Hierarchy

KT Couriers uses the standard Tailwind CSS v4 responsive breakpoint classes to adjust page compositions dynamically:

*   **Compact Mobile (`< 640px`)**: Default viewport. Single-column stacked layouts. All navigation moves to the bottom navigation bar. Page margins are set to `px-4`.
*   **Tablet Portrait (`640px - 768px`)**: `sm:` modifier triggers. Grids shift from single-column to 2-column. Floating panels stack vertically. Page margins expand to `px-6`.
*   **Tablet Landscape (`768px - 1024px`)**: `md:` modifier triggers. Desktop navigation sidebar becomes visible, but collapses into an icon-only strip. Layout elements move into two-column configurations.
*   **Desktop Standard (`1024px - 1280px`)**: `lg:` modifier triggers. The navigation sidebar expands to full width with text labels. Main content area limits max-width to `max-w-5xl` or `max-w-7xl` to prevent stretching.
*   **Large Screens (`> 1280px`)**: `xl:` modifier triggers. Layouts utilize side-by-side card sections and multi-column overview panels.

---

## 2. Shell Navigation Adapts Dynamically

The `DashboardShell` adapts layout structure automatically using viewport checks:

*   **Desktop/Tablet Viewport (`md:` and above)**:
    *   The persistent left sidebar is rendered (`flex flex-col w-64 border-r`).
    *   The mobile bottom navigation bar is hidden (`hidden`).
    *   The top app header displays profile information, role status, and optional primary dispatch action buttons.
*   **Mobile Viewport (`< md`)**:
    *   The left sidebar is completely hidden (`hidden`).
    *   The persistent mobile bottom navigation bar is rendered (`fixed bottom-0 left-0 right-0 h-16 border-t bg-white`).
    *   The top app header is simplified to show the screen title and a hamburger trigger for account settings only.

---

## 3. Viewport Clearance Contract (Bottom Navigation)

> [!IMPORTANT]
> To prevent the fixed mobile bottom navigation bar from obscuring interactive form buttons, input text, or pagination links, the following spacing contract must be strictly followed on all child screens:
> - The root container of any screen loaded within the dashboard must include a bottom padding class: `pb-24` (96px).
> - This guarantees a clear `32px` margin above the `64px` height of the fixed navigation bar, ensuring that "Submit Order" and "Back" action triggers are fully clickable and never overlap.
