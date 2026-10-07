# Optional recruitment test exclusion

The closure directive requires canonical customer, vendor, driver, employee and
admin workflows. The Phase 26 applicant recruitment programme is a separate
optional pipeline and remains inactive for production execution. This exclusion
does not certify recruitment or its placeholders.

`lib/recruitment/production-readiness.ts` exports
`RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false`.
`assertRecruitmentProductionReady()` throws while that reviewed source lock is
false. Its production checks guard application submission, opening publishing,
evaluation finalization, offer issue/acceptance, workforce onboarding handoffs
and retention execution in the corresponding `lib/recruitment` services.
`composition-root.ts` reports the composition as `LOCKED`. No environment flag
or closure fixture enables this pipeline.

Only `tests/phase26/e2e/` and `tests/phase26/integration/` are covered by this
source-bound exclusion. The audit parses the actual exported constant; comments,
environment-controlled values, non-constant declarations and a true lock value
cannot qualify. Changing the lock requires these suites to become release
critical again and requires actual functional and database certification before
activation. Public or administrative reads of historical recruitment records
are not claimed to be absent, disabled or validated by this exclusion.

Canonical driver registration/profile/onboarding uses
`lib/services/driver-profile.service.ts` and `app/api/driver/onboarding/route.ts`.
Existing employee access, order dispatch, driver GPS/POD, cash and earnings are
outside the excluded directories and remain release-critical. Driver/employee
recruitment handoff scaffolds cannot replace tests of those authorities.

The nested-skip parser first exposed 41 open critical placeholders. Source and
scope review excludes 22 recruitment placeholders; 19 active critical
placeholders remain open. The two Phase 26 screening/retention placeholders were
already marked optional. All 24 Phase 26 placeholders remain visible as
`EXCLUDED_WITH_SCOPE`, never `PASS`, in `TEST_DEFERRALS.md`.
