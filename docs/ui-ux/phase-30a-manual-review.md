# Phase 30A — Manual Visual Review Checklist

This document details the manual visual checks, responsive checkpoints, browser compatibility testing, and accessibility validations implemented toward WCAG 2.2 AA (runtime browser, keyboard, zoom, screen-reader and contrast validation remains required) to verify the implementation of Phase 30A.

---

## 1. Visual Verification & Layout Review

Every new or modified screen must be checked against the following parameters:
- **No Overlapping Text**: Check all text blocks in both English and localized Afrikaans or isiXhosa previews to ensure no overlapping line-heights or text clipping.
- **Image Aspect Ratios**: WebP illustrations (e.g. Cape Town route graphics) must maintain proper aspect ratios (`aspect-video` or `object-cover`) across all window resizes.
- **Consistent Icons**: Vector SVGs must align vertically with neighboring text labels and maintain uniform stroke-width properties (`stroke-2`).
- **Scroll Containment**: Long tables (e.g. transactions, invoice history) must use responsive scroll containers (`overflow-x-auto`) to prevent parent card blowout.
- **Touch Target Sizing**: Ensure all interactive buttons, input fields, selects, and anchors satisfy the minimum effective target size of 48px for WCAG 2.2 AA conformance.

---

## 2. Responsive Breakpoint Checkpoints

Verify that the application transitions smoothly across the following viewport dimensions:
1.  **320px (Compact Mobile)**: Ensure the bottom navigation bar fits screen width, top bar titles truncate cleanly, and input forms stack with `px-4` padding.
2.  **480px (Standard Mobile)**: Form fields within `DeliveryRequestForm` must span full width, and cards must render with `rounded-2xl` borders.
3.  **768px (Tablet Portrait)**: Verify that the desktop sidebar is hidden and the bottom nav bar remains active. Grids (e.g. marketplace items, coverage areas) should adapt to 2 columns.
4.  **1024px (Tablet Landscape)**: Verify that the left sidebar becomes visible, the mobile bottom nav bar disappears, and main dashboards display profile headings properly.
5.  **1440px (Desktop Full)**: Ensure containers are centered with a maximum width (`max-w-6xl` or `max-w-7xl`) and no elements stretch excessively.

---

## 3. Mobile Browser Checklist (Chrome & Safari)

To ensure high-fidelity web experiences on mobile devices, check the following details:
- **Bottom Navigation Clearance**: Scroll to the absolute bottom of long forms (such as pickup details). Ensure that buttons are completely visible and clickable, with at least `32px` of vertical spacing above the navigation bar.
- **Double-Tap Zoom Protection**: Interactive buttons must include `touch-manipulation` attributes to prevent browser zoom delay.
- **Native Date Pickers**: Ensure that date inputs in shuttle booking and scheduler steps trigger native OS calendar popups on iOS and Android.
- **Input Autocomplete Behavior**: Ensure address search inputs do not prompt standard browser credential managers.

---

## 4. Connectivity Banner Simulation

To verify connectivity semantics:
1.  Open the browser developer tools and navigate to the **Network** tab.
2.  Select the **Throttling** dropdown and choose **Offline**.
3.  Verify that `OfflineBanner.tsx` appears immediately at the very top of the window with the exact text:
    `"You appear to be offline. Some information may be outdated and actions that require a connection may not complete."`
4.  Switch the throttling setting back to **Online** and verify that the banner disappears instantly.
