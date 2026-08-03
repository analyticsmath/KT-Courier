# R19 applicant route matrix

| Paths | Boundary / authority | Primary presentation | Mobile / risk |
| --- | --- | --- | --- |
| `/applicant`, `/applications` | authenticated user + owned applicant profile | current application and list | one column; no KPI row |
| `/applications/[reference]/*` | owned recruitment application | safe status, documents, checks, interviews, offer | stacked dossier sections; internal evidence excluded |
| `/applications/new/[openingReference]` | public opening / broken legacy start contract | explicit unavailable state | avoids fake draft |
| `/profile`, `/privacy`, `/data-requests`, `/notifications` | applicant profile/privacy/notification projections | source-honest unavailable or minimal state | no role inbox or invented legal content |

All routes are noindex and canonical-suppressed by the applicant layout. No tokenized applicant route exists in the repository.
