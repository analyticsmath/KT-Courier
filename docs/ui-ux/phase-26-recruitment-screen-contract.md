# Phase 26 Recruitment & Onboarding Screen Contract

## Overview
This document specifies the exact screen contract, route mapping, and permissions for all 41 Phase 26 recruitment surfaces across Public Careers, Applicant Portal, and Admin Command Centre.

## Public Careers Pages (2 Routes)
1. `/careers/jobs` (`app/(public)/careers/jobs/page.tsx`)
   - **Contract**: Lists open published positions. Public access. Supports track and search filters.
2. `/careers/jobs/[reference]` (`app/(public)/careers/jobs/[reference]/page.tsx`)
   - **Contract**: Shows public job details, safe DTO, zero-fee statement, accessibility info, and Apply CTA button.

## Applicant Portal Pages (16 Routes)
1. `/applicant` (`app/(public)/applicant/page.tsx`)
   - **Contract**: Main applicant navigation dashboard.
2. `/applicant/profile` (`app/(public)/applicant/profile/page.tsx`)
   - **Contract**: Canonical applicant profile form (legal name, contact phone, work authorization).
3. `/applicant/applications` (`app/(public)/applicant/applications/page.tsx`)
   - **Contract**: Lists applicant's draft and submitted job applications with stage indicator.
4. `/applicant/applications/new/[openingReference]` (`app/(public)/applicant/applications/new/[openingReference]/page.tsx`)
   - **Contract**: Initializes draft application linked to immutable opening version.
5. `/applicant/applications/[reference]` (`app/(public)/applicant/applications/[reference]/page.tsx`)
   - **Contract**: Application dashboard showing current stage, status, and navigation to steps.
6. `/applicant/applications/[reference]/personal-details` (`app/(public)/applicant/applications/[reference]/personal-details/page.tsx`)
   - **Contract**: Step 1 - Personal details view & profile edit link.
7. `/applicant/applications/[reference]/questions` (`app/(public)/applicant/applications/[reference]/questions/page.tsx`)
   - **Contract**: Step 2 - Screening form questions & answers form.
8. `/applicant/applications/[reference]/documents` (`app/(public)/applicant/applications/[reference]/documents/page.tsx`)
   - **Contract**: Step 3 - Required document upload & validation status.
9. `/applicant/applications/[reference]/review` (`app/(public)/applicant/applications/[reference]/review/page.tsx`)
   - **Contract**: Step 4 - Final review & immutable submission (asserts production lock).
10. `/applicant/applications/[reference]/confirmation` (`app/(public)/applicant/applications/[reference]/confirmation/page.tsx`)
    - **Contract**: Confirmation banner with public reference.
11. `/applicant/applications/[reference]/interviews` (`app/(public)/applicant/applications/[reference]/interviews/page.tsx`)
    - **Contract**: View scheduled interviews, select slots, request reschedule.
12. `/applicant/applications/[reference]/checks` (`app/(public)/applicant/applications/[reference]/checks/page.tsx`)
    - **Contract**: View background checks & provide explicit written consent.
13. `/applicant/applications/[reference]/offer` (`app/(public)/applicant/applications/[reference]/offer/page.tsx`)
    - **Contract**: View issued employment/network offer, accept (asserts lock) or decline.
14. `/applicant/privacy` (`app/(public)/applicant/privacy/page.tsx`)
    - **Contract**: View published privacy notices.
15. `/applicant/data-requests` (`app/(public)/applicant/data-requests/page.tsx`)
    - **Contract**: View and submit POPIA data subject privacy requests.

## Admin Command Centre Pages (23 Routes)
1. `/admin/recruitment` (`app/(admin)/admin/recruitment/page.tsx`) - Main dashboard & production lock status.
2. `/admin/recruitment/requisitions` (`app/(admin)/admin/recruitment/requisitions/page.tsx`) - Requisitions list.
3. `/admin/recruitment/requisitions/[reference]` (`app/(admin)/admin/recruitment/requisitions/[reference]/page.tsx`) - Requisition detail & submit/approve/reject controls.
4. `/admin/recruitment/openings` (`app/(admin)/admin/recruitment/openings/page.tsx`) - Openings list.
5. `/admin/recruitment/openings/new` (`app/(admin)/admin/recruitment/openings/new/page.tsx`) - Create draft opening.
6. `/admin/recruitment/openings/[reference]` (`app/(admin)/admin/recruitment/openings/[reference]/page.tsx`) - Versioning & publication controls.
7. `/admin/recruitment/applications` (`app/(admin)/admin/recruitment/applications/page.tsx`) - Applications queue.
8. `/admin/recruitment/applications/[reference]` (`app/(admin)/admin/recruitment/applications/[reference]/page.tsx`) - Candidate application review & human decision controls.
9. `/admin/recruitment/interviews` (`app/(admin)/admin/recruitment/interviews/page.tsx`) - Interviews list.
10. `/admin/recruitment/interviews/[reference]` (`app/(admin)/admin/recruitment/interviews/[reference]/page.tsx`) - Interview detail & completion.
11. `/admin/recruitment/checks` (`app/(admin)/admin/recruitment/checks/page.tsx`) - Background checks list.
12. `/admin/recruitment/checks/[reference]` (`app/(admin)/admin/recruitment/checks/[reference]/page.tsx`) - Check case detail & human review pass.
13. `/admin/recruitment/offers` (`app/(admin)/admin/recruitment/offers/page.tsx`) - Offers list.
14. `/admin/recruitment/offers/[reference]` (`app/(admin)/admin/recruitment/offers/[reference]/page.tsx`) - Offer detail, headcount check, approval & issue controls.
15. `/admin/recruitment/handoffs` (`app/(admin)/admin/recruitment/handoffs/page.tsx`) - Onboarding handoffs list.
16. `/admin/recruitment/handoffs/[reference]` (`app/(admin)/admin/recruitment/handoffs/[reference]/page.tsx`) - Handoff detail & process to canonical Employee/Driver authority.
17. `/admin/recruitment/fraud` (`app/(admin)/admin/recruitment/fraud/page.tsx`) - Fraud cases list.
18. `/admin/recruitment/fraud/[reference]` (`app/(admin)/admin/recruitment/fraud/[reference]/page.tsx`) - Fraud case detail.
19. `/admin/recruitment/reconciliation` (`app/(admin)/admin/recruitment/reconciliation/page.tsx`) - Reconciliation cases list.
20. `/admin/recruitment/reconciliation/[reference]` (`app/(admin)/admin/recruitment/reconciliation/[reference]/page.tsx`) - Reconciliation detail & specific recovery retries.
21. `/admin/recruitment/privacy` (`app/(admin)/admin/recruitment/privacy/page.tsx`) - Privacy notice versions administration.
22. `/admin/recruitment/retention` (`app/(admin)/admin/recruitment/retention/page.tsx`) - Retention schedule administration & lock indicator.
23. `/admin/recruitment/employment-equity` (`app/(admin)/admin/recruitment/employment-equity/page.tsx`) - Aggregated EE reporting projections & data isolation notice.
