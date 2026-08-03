# R22 responsive and accessibility matrix

`SOURCE_AUDITED` records architecture/source evidence only. Every `MANUAL_REQUIRED` cell still needs browser/assistive-technology verification by Muzammil; no completed browser run is claimed.

| Workspace | 320/360/390/430 | 600/768/834 | 1024/1280/1440/1920 | Landscape / keyboard | Forced colours / reduced motion | 200% zoom / 400% reflow |
| --- | --- | --- | --- | --- | --- |
| Customer | SOURCE_AUDITED + MANUAL_REQUIRED: bottom nav, record lists | SOURCE_AUDITED + MANUAL_REQUIRED: table transition | SOURCE_AUDITED + MANUAL_REQUIRED: rail/capped content | MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Store | SOURCE_AUDITED + MANUAL_REQUIRED: top bar, catalog/forms | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Driver | SOURCE_AUDITED + MANUAL_REQUIRED: bottom nav, action detail | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED, including OTP/software keyboard | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Promoter | SOURCE_AUDITED + MANUAL_REQUIRED: full navigator/records | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Developer | SOURCE_AUDITED + MANUAL_REQUIRED: stack tables/secret panel | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED, long scopes/endpoints/code | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Applicant | SOURCE_AUDITED + MANUAL_REQUIRED: dossier one column | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Administration | SOURCE_AUDITED + MANUAL_REQUIRED: stack/bounded tables | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED, permission matrices/finance | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |
| Payment handoff | SOURCE_AUDITED + MANUAL_REQUIRED: one-column panels | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED | MANUAL_REQUIRED, external provider return | SOURCE_AUDITED + MANUAL_REQUIRED | SOURCE_AUDITED + MANUAL_REQUIRED |

Manual checklist: one H1 per route; skip link/main/nav labels; route-current semantics; visible focus/order/restore; dialogs/drawers Escape and containment; table caption/headers/stack records; ordered timelines; OTP paste/autocomplete; form labels/errors/summary; safe error/success announcement; long URL/reference/scope wrapping; root overflow; safe areas; software keyboard; no hover/drag-only operation; colour-independent statuses; network/console secret review.
