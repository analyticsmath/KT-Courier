# Railway patch: preserve the live worker

Fresh readback: patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` remains **STAGED**, destructive, with **five detailed changes**. The status summary groups them into three changes; the full diff is authoritative. It creates `paystack-credential-test` with image/restart/start config plus a redacted PAYSTACK_SECRET_KEY, and deletes live worker `fdd13e91-dffa-400e-9a44-ae2d1f891ff0` (`query-storefront-categories`).

No accept, deploy, blanket discard, secret rotation or service mutation was performed. Worker deployment `8220e084-6ad3-4467-b3d8-65afe8fe29ff` remains SUCCESS.

Selective plan for the infrastructure owner: re-read/export a redacted exact diff; identify unrelated staged changes; remove only the worker deletion intent using the supported dashboard/API mechanism and verify the worker remains present/healthy; separately remove or disposition the unapproved credential-test creation/variable intent; verify no secret was deployed/exposed and rotate only if separately required/approved; re-read the complete remaining diff; authorize only an exact reviewed safe diff. If selective edit is unsupported, stop and obtain a scoped replacement plan. Do not accept the dangerous patch merely to clear pending state. Named approver and execution record remain null.
