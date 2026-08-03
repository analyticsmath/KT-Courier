# R19 — Recruitment Applicant Experience

## Objective and verified boundary

R19 replaces the legacy client JSON screens with a dedicated Candidate Dossier at the same `/applicant/*` paths. Route-group structure, rather than pathname detection, separates it from Editorial Freight and every role dashboard. The live authority is the existing authenticated `User` session plus owner-scoped `RecruitmentApplicantProfile`; there is no candidate-session cookie, token link, or `APPLICANT` role in the repository. No auth, recruitment service, schema, API route, or production lock changed.

## Route inventory

The retained routes are `/applicant`, `/applicant/applications`, `/applicant/applications/new/[openingReference]`, `/applicant/applications/[reference]`, and its `personal-details`, `questions`, `documents`, `checks`, `interviews`, `review`, `confirmation`, and `offer` children; plus `/applicant/profile`, `/applicant/privacy`, `/applicant/data-requests`, and `/applicant/notifications`. All are applicant-private, server-gated by `requireAuth`, noindex, omitted from sitemap, and use one dedicated main landmark.

## Presentation and limitations

The overview prioritises opening identity, candidate-safe mapped lifecycle state, and the available dossier routes. Status mapping is explicit in `lib/applicant-presentation/applicant-status.ts`; unknown values are neutral. Documents expose only category, name, and validation state. Checks exclude evidence and notes. Interviews show only safe status and source time in explicit UTC. Offers are view-only because the current API lacks a complete candidate confirmation contract.

The legacy start route passed a placeholder form version and public opening reference where the service expects internal authority. Legacy answers, uploads, submission, profile creation, privacy requests, and notification views similarly either hard-coded fixture data, generated browser operation identifiers, or lacked safe candidate projections. R19 presents these limitations rather than inventing forms, file uploads, legal copy, slots, or success states. R20 boundary: Administration Operations I.
