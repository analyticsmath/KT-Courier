# R17 — Promoter Mobile Architecture

## Navigation and order

Promoter compact mode keeps the R13 labelled top bar and full-screen navigator. It does not inherit customer bottom navigation. Overview content is ordered: programme state, referral-tools action, compact source-backed metrics, current masked referral code, qualification activity, and finance context. Desktop moves finance context into a secondary rail; compact mode never shows that rail.

## Records and actions

Referral, earning, withdrawal, code, programme, asset, dispute, and notification data surfaces are semantic lists below 600px. Each record has a clear reference/title, text status, safe supporting facts, and a dedicated detail link when the live route has one. Tables remain desktop/tablet-only. There are no horizontally squeezed financial tables, charts, permanent sidebars, tiny overflow menus, drag controls, or hover-only actions.

Referral tools show masked server values only. Because the canonical projection does not provide a full code/share URL, compact mode intentionally has no copy, share, or QR control. Forms for code, enrolment, compliance, profile, evidence, and withdrawal are not rendered while their canonical production lock is active; no disabled faux-action is used.

## Forms, keyboard, and safe areas

R17 adds no new mutable promoter form. Existing route action availability is communicated before a user reaches a non-functional control. Navigation and route actions have a minimum 44px target, use native links/buttons, remain reachable with a software keyboard, and use the R13 safe-area spacing. The existing focus-visible, Escape/focus-managed navigator, reduced-motion, forced-colours, 200% zoom, and 400% reflow rules apply.

## Responsive review points

At 320, 360, 390, and 430px, one-column records carry primary state and date/amount context. At 600–834px, the existing top bar and controlled two-column metric layout may appear. At 1024px and wider, the R13 rail is persistent and the overview may add its context rail. No page-level horizontal overflow is intentional; mobile landscape remains a stacked-record experience.

## Privacy

Compact record detail never substitutes customer identity for an attribution reference. It omits full email/phone, addresses, order/payment data, device/IP data, fraud signal, evidence, and internal financial fields. Amounts carry explicit ZAR and held/available language in text, not colour alone.
