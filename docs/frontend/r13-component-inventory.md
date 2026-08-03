# R13 — Protected Component Inventory

| Path/group | Responsibility | Server/client | Accessibility/responsive contract | Intended phase and migration state |
| --- | --- | --- | --- | --- |
| `foundation/ProtectedVisualRoot` | Scoped visual boundary and fonts | Server | Local stacking context and scoped focus/tokens | R13; mounted by shell |
| `shell/EditorialOperationsShell` | Root protected layout and landmark | Server | Skip target, single main, safe area | R13; account/store/driver/admin/payment adopted |
| `shell/EditorialTopbar` | Context, notification, account controls | Client island | Named controls, Escape account menu | R13; mounted through mobile controller |
| `navigation/ProtectedNavigation` | Desktop rail, groups, active state | Client island | Named nav, current page, keyboard disclosure | R13; mounted by shell |
| `navigation/ProtectedMobileNavigation` | Mobile bottom/nav-sheet policy | Client island | Visible labels, 44px targets, full navigator | R13; mounted by shell |
| `navigation/types` | Safe registry presentation contract | Shared type-only | No user/session/permission records | R13; registry authority |
| `icons/ProtectedIcon` | Restrained reusable line icons | Server-compatible | Icons are always paired with labels | R13; internal only |
| `overlays/ProtectedDrawer` | Accessible sheet/drawer | Client island | Modal semantics, title, close, Escape, focus return | R13; future protected use |
| `overlays/ProtectedDialog` | Accessible dialog | Client island | Same focus and close contract | R13; future protected use |
| `overlays/useOverlayFocus` | Shared overlay behavior | Client hook | Focus trap and scroll lock | R13; internal only |
| `surfaces/ProtectedPageHeader` | H1/action/breadcrumb foundation | Server | Semantic heading; wraps actions | R14+; not yet substituted in pages |
| `surfaces/ProtectedPageFrame` | Page rhythm and optional context rail | Server | Reflows from one to two columns | R14+; not yet substituted |
| `surfaces/OperationalPanel` | Bordered panel and metric tile | Server | No fixed universal height; tabular values | R14+; not yet substituted |
| `data/EditorialTable` | Semantic table frame | Server | Caption, scopes, `aria-sort`, explicit mobile mode | R14+; not yet substituted |
| `data/FilterAndPagination` | Filter state and pagination presentation | Server | Named pagination/current page | R14+; not yet substituted |
| `feedback/ProtectedStatus` | Restrained semantic status | Server | Text plus shape/marker; not colour alone | R14+; not yet substituted |
| `feedback/ActivityTimeline` | Chronological activity list | Server | Ordered list/time semantics | R14+; not yet substituted |
| `feedback/ProtectedState` | Empty/unavailable/restricted/locked/error frame | Server | Explicit state copy and optional art | R14+; not yet substituted |
| `forms/ProtectedFormSections` | Section, error summary, action bar | Server | Heading links and `role=alert` | R14+; not yet substituted |
| `visualizations/ChartContainer` | Data-free chart frame | Server | Data alternative slot; no fixture series | R14+; not yet substituted |
| `scheduling/DateStrip` | Date selector presentation | Server | Date/current semantics and horizontal reflow | R15/R16+; not yet substituted |
| `scheduling/AgendaList` | Agenda presentation | Server | Ordered list and status markers | R15/R16+; not yet substituted |
| `illustrations/*` | Four data-free SVG illustrations | Server | Decorative by default; labelled when requested | R13; ready for future states |

Legacy equivalents (`DashboardSidebar`, `DashboardTopbar`, `MobileDashboardNav`, generic Card/Table/Modal/Drawer) remain available. The DashboardShell adapter now delegates to the R13 shell; the other legacy pieces are not deleted because unrelated feature consumers may still import them.
