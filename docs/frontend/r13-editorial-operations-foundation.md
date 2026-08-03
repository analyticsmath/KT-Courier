# R13 — Editorial Operations Foundation

## Objective

R13 introduces a protected, light-mode Editorial Operations shell and reusable presentation foundations. It deliberately changes no role-page body, service, route guard, session, permission definition, production lock, payment flow, map flow, database file, migration, package, or public/auth visual root.

## Implementation map

| Area | Current responsibility | R13 change | Server/client | Role/context and permission impact | Mobile and accessibility | Compatibility and risk |
| --- | --- | --- | --- | --- | --- | --- |
| `app/globals.css` | Global legacy and public tokens | Adds only `[data-kt-protected-system]` tokens and component rules | CSS | All protected contexts; no permission logic | Focus, forced colors, reduced motion; no root overflow | Public selector remains unchanged; scoped root prevents leakage. |
| `app/fonts/protected-fonts.ts` | No protected local font authority | References the existing local Mona Sans and Newsreader files with protected variables | Server build-time font module | All contexts; no permission logic | Tabular numbers and responsive local loading | No font binary duplication. |
| `components/layout/DashboardShell.tsx` | Client-wide legacy dashboard wrapper | Server compatibility adapter to the R13 shell | Server adapter | Preserves legacy caller input; no new authority | Registry-derived mobile behavior; new skip/main structure | Preserves the public prop API for remaining callers. |
| Account/store/driver/admin/payment layouts | Guards, display projection, legacy shell mount | Keep guards/page children; project safe nav and notification count server-side | Server | Customer, store, driver, admin, super-admin; existing effective permissions filter nav | Bottom nav only for customer/driver; 44px controls and full drawer | No page-body migration; payment routing is retained. |
| `lib/protected-navigation/*` | Flat role constants | Context registry, server permission projection, grouped admin workspace model | Server resolution | Six roles plus developer context; applicant excluded; existing permission service only | Mobile priorities have no hardcoded role menu | Navigation is convenience only; page guards remain authoritative. |
| `components/protected-v2/*` | No protected namespace | Shell, interaction islands, primitives, overlays, illustrations | Mostly server; named client islands | Presentation-safe user props only; no raw permission/session data | Landmark, dialog, table, state, reflow foundations | Gradual opt-in foundation for R14–R21. |

## Protected visual root and typography

`ProtectedVisualRoot` owns `data-kt-protected-system="editorial-operations-v1"`, a local stacking context, Editorial Operations tokens, Mona Sans UI typography, Newsreader editorial accent typography, tabular numeral support, reduced-motion rules, and forced-colors focus treatment. It is not applied to `html`, `body`, public routes, auth routes, Open Graph generation, or the public `editorial-freight-v1` root.

The separate protected font module uses the existing four local font assets. It neither downloads remote fonts nor copies font binaries.

## Tokens and density

The scoped system uses the approved mineral canvas, white surface, carbon text, oxide signal, and operational teal palette. Its rhythm is 4/8/12/16/20/24/32/40/48px; controls use 9px corners, compact surfaces 11px, panels 14px, and large panels 16px. Borders supply separation; only overlays use one neutral elevation shadow. No protected purple, ivory, gradient, glass, or role colour identity is introduced.

## Shell architecture

`EditorialOperationsShell` is a Server Component. It renders the protected root, skip link, desktop rail island, mobile/topbar island, and one `main#protected-main-content` landmark. Navigation is the only substantive client island; it owns route-state styling, group disclosure, the account menu, mobile bottom navigation, and the full-screen navigator. Page content remains outside any page-wide client wrapper.

The desktop rail is 240px on wide desktops and a labelled, explicitly expandable 84px rail at intermediate desktop widths. The shell has a 1440px content cap, a responsive page gutter, safe-area bottom spacing, and an optional `ProtectedContentGrid` contextual rail for subsequent phases.

## Legacy compatibility and adopted layouts

The existing `DashboardShell` remains as a documented server compatibility adapter. Its existing prop contract is retained, but its customer-only hardcoded bottom navigation has been removed. The following guarded layouts now mount the new shell directly and preserve their existing body children and guards:

- `app/(account)/account/layout.tsx`
- `app/(store)/store/layout.tsx`
- `app/(driver)/driver/layout.tsx`
- `app/(admin)/admin/layout.tsx`
- `app/(payments)/layout.tsx`

Promoter and developer currently have no protected route layout; the developer catch-all must also preserve a public `/developers` overview. Adding a shell layout there would alter an existing public/auth boundary, so both are intentionally deferred. Applicant remains outside the formal protected-role registry and unchanged for R19.

## Accessibility

The shell exposes a focus-revealed skip link, named desktop/mobile navigation, current-page semantics, visible focus, semantic table contracts, status text plus a marker, 44px mobile controls, safe-area support, reduced-motion rules, and forced-colors support. `ProtectedDrawer` and `ProtectedDialog` use labelled dialogs, close buttons, Escape, focus containment, focus restoration, scroll lock, and route-link close behavior. Browser and assistive-technology proof remains manual validation work.

## Performance and security

Navigation permissions resolve on the server with `getEffectivePermissionKeysForUser`; only filtered links are serialized. User input to the shell is display name, role label, and optional avatar URL. Session tokens, full user records, raw permissions, Prisma models, lock evidence, credentials, and financial/private DTOs are not shell props. The shell adds no chart, calendar, animation, or icon dependency and has no GSAP import.

Navigation does not authorize a page. Existing `requireRole`, `requireAdminPagePermission`, and service/API checks are unchanged.

## Adoption strategy and limitations

R14–R21 can replace individual page presentation with protected-v2 primitives incrementally. Existing generic UI primitives are intentionally untouched: creating protected replacements avoids changing live role bodies and avoids spreading R13 token semantics into public or legacy feature surfaces. The legacy Modal/Drawer are not modified; new protected overlays meet the R13 interaction contract for new work.

Known limitations: no browser matrix was run, no full repository typecheck was run, no page body uses the new table/card/agenda/chart foundation yet, and promoter/developer/applicant shell adoption remains blocked by existing route-boundary evidence.

## R14 boundary

R14 may adopt these foundations only for **Customer Account and Delivery Experience**. No R14 page redesign is included here.
