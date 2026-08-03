# R13 — Protected Navigation Architecture

## Verified contexts

Formal roles are `CUSTOMER`, `STORE`, `DRIVER`, `PROMOTER`, `ADMIN`, and `SUPER_ADMIN`. `DEVELOPER` is a protected presentation context available to customer/store users with existing developer permissions; it is not a formal role. Applicant is intentionally absent from this registry.

| Context | Desktop | Mobile | Current R13 mount |
| --- | --- | --- | --- |
| Customer | Grouped rail | Four registry priorities plus More navigator | Account layout |
| Store | Grouped rail | Top bar plus full navigator | Store and payment layouts |
| Driver | Grouped rail | Four registry priorities plus More navigator | Driver layout |
| Promoter | Grouped rail design available | Top bar plus full navigator | Not mounted; no protected layout exists |
| Developer | Grouped rail design available | Top bar plus full navigator | Not mounted; `/developers` has a public zero-segment entry |
| Admin | Eight grouped workspaces | Full-screen workspace navigator | Admin layout |
| Super admin | Same grouped registry, server-super permission projection | Full-screen workspace navigator | Admin layout |

## Registry and permission filtering

`protected-navigation-registry.ts` has only route-backed items, stable IDs, semantic icons, exact-route flags, context membership, mobile priority, and existing permission keys where applicable. `getProtectedNavigationForUser` validates the role/context pairing, calls the existing `getEffectivePermissionKeysForUser` server authority, filters groups before serialization, then returns no raw permission list.

The registry contains no placeholder URLs, no applicant role insertion, no route invented for visual balance, and no role-specific palette metadata. Route guards remain mandatory even when a link is hidden.

## Admin workspaces

The old flat administrative list is projected into these route-backed group labels:

1. Command centre
2. Operations
3. People and network
4. Commerce
5. Finance
6. Growth programmes
7. Platform
8. Governance

Each group is omitted when permission filtering leaves it empty. Group buttons use `aria-expanded`; no hover-only submenu exists.

## Responsive navigation

At 1024–1279px the rail is compact with accessible names/tooltips and an explicit expand/collapse button. At 1280px it is expanded. Mobile customer/driver destinations derive only from `mobilePriority` in the registry. Their More entry opens a focus-managed full-screen navigator for remaining routes. Store, promoter, developer, admin, and super-admin do not receive a misleading five-item bottom bar.

## Current route behavior and migration risks

Route state is determined in the isolated navigation client component by pathname; exact root routes do not incorrectly activate their descendants. Link labels stay in the accessibility tree in compact rail mode, and active state uses border/weight/marker as well as colour.

R12 inventory drift was confirmed: the requested `r11-defect-register.md` is missing, current admin user routes use `/admin/users` rather than the inventory’s `/admin/customers`, and the live route tree contains more route files than the 118-route summary. The registry follows current route files and existing guard/permission names, not stale route labels.
