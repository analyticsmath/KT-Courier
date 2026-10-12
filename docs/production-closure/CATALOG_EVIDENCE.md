# Canonical listing draft evidence

Classification remains NOT_READY. This candidate repairs a wizard that collected
SKU, price, stock, variants and modifiers but saved only the product and images.
The new authenticated listing command composes the existing product, variant,
offer, price, inventory, modifier and media services in one transaction. It saves
editable draft records, requires the existing manage/pricing/inventory authorities,
and preserves separate moderation, activation and publication commands.

The offer sells the Default variant with owner-authored SKU, exact VAT-inclusive
ZAR price and opening stock at an existing active store location. Additional
variant definitions and flat modifiers are persisted. No commission, parcel
classification, live inventory authenticity or commercial approval is inferred.
Existing owner/store draft isolation and unattributed legacy-draft exclusion remain.

An actor/action operation lock and matching receipt serialize unchanged retries.
Changed facts conflict. All listing writes roll back when a later media ownership
check fails or an existing store SKU conflicts. Duplicate suggestions now include
only this store's private products and published approved shared products, and
return public references rather than internal candidate identities.

Local closure PostgreSQL validation passes 142 assertions across eighteen files,
zero skipped (94.56 seconds), including six new actual listing checks. They prove
complete draft facts, concurrent replay, changed-operation conflict, rollback,
foreign locations/media, invalid attributes, duplicate SKU preservation and private
duplicate-search isolation. Synthetic READY media source facts exercise attachment
and transaction integrity; they are not upload/storage or vendor authenticity proof.
Earlier runs caught an invalid fixture storage key, a duplicate completion-event
version and a SKU-normalization assertion. Constraints and canonical normalization
remain intact.

Normalized upload keeps Cloudinary in production. Only the exact named,
network-isolated disposable browser database and private test directory can select
the local adapter. Eight guard checks reject production, remote, unisolated and
wrong-directory sources. Two desktop/phone browser journeys now exercise actual
raster upload, native controls, full canonical save, lost-confirmation replay,
duplicate suggestions and authorization. Discovery totals 84 Chromium assertions
in 23 files. Execution and eight new captures remain pending.

Local full unit/API validation passes 3,479 assertions in 766 files, zero skipped
(96.71 seconds). Fifteen focused storage-policy/image/authorization assertions,
eight existing canonical-service/UI assertions and eleven native release-helper
assertions pass. Lint, explicit ignored-fixture lint, TypeScript and the optimized
production build pass. Exact-commit CI is still required.

Ten critical placeholders remain in 75 marked files. Complete catalog
moderation/publication, imports, paid order/refund/media and directed visual
acceptance remain open; this partial engineering evidence does not certify them.

At f45c3186084cc90b1a841f648137aba282d941a3, certification run 37676487379
passes twenty PostgreSQL jobs, quality, Redis/security and recovery. Its closure
runner executes 142 assertions in eighteen files, zero skipped (23.89 seconds). The browser
job passes 82 existing assertions and fails both new listing assertions at the
first validation check: Next's route announcer and the listing error summary both
have the alert role. The final certified job is skipped after browser failure.
The next candidate scopes those assertions to the actual listing errors. Upload,
save and replay acceptance remain unproven by this failed run.

The moderation follow-up reads source state and operation receipts inside its
transaction after operation and subject locks. Matching retries return current
canonical state without repeating review; changed notes/reasons/subjects conflict.
Suspension appends history to the latest case, including a resolved approval case,
and reopening for changes clears the case's resolution timestamp. Native product
review controls prevent duplicate clicks and preserve operation identity after an
uncertain response. Six new PostgreSQL cases cover replay, competing decisions,
rollback, immutable history, offer approval without activation and subject reuse;
their execution is pending because local Docker Desktop crashes during inference
socket initialization. The isolated CI runner remains required.

Eleven focused moderation/state/media-policy assertions pass, as do TypeScript,
full lint, explicit ignored-fixture lint and the optimized build. Two
desktop/phone moderation journeys bring discovery to 86 in 24 files;
four moderation captures require execution and inspection. Source inventory now
contains nine critical placeholders in 74 marked files. Full catalog imports,
publication, media review/quarantine and vendor acceptance remain open.

At 42a0ecdfe7de8d749b86bc08177368628e01c6a2, the isolated CI closure runner
passes all 148 assertions in eighteen files with zero skipped, including all six
new moderation cases and six listing cases. The downloaded canonical JSON and
certification-command artifacts independently report PASS, no critical skips and
no flaky assertions. Quality and main CI also pass. The browser job passes 82
existing assertions and fails all four new catalog journeys before writes: their
category selector expects `Electronics · electronics`, while the canonical
category path is `/electronics` and its actual option is
`Electronics · /electronics`. Downloaded error snapshots confirm the actual
option; the phone failure capture was inspected. The next candidate corrects the
exact option label. Save, review and their twelve captures remain unproven by
this run, and the final certified job is skipped after browser failure.

Further inspection found that owner and admin product read endpoints included
the full asset row. The next candidate reuses the existing safe intake projection
for both: safe lifecycle/dimensions remain available, while storage keys, provider
identity, full checksums and asset actor identity are omitted. Authorized admin reads
retain existing safe review reason codes. Nine focused media/product assertions,
TypeScript, full lint and the optimized build pass. PostgreSQL and
browser checks are extended to reject storage/provider fields in product reads;
fresh exact-commit execution is still required for this projection change.

The full local unit/API suite for the projection candidate passes all 3,480
assertions in 766 files, zero skipped (80.32 seconds). It does not substitute for
the extended actual PostgreSQL assertions or owner/admin browser reads.

The current candidate removes successful-run screenshots from the selected
catalog functional suites. Planned capture language above describes historical
candidates, not a future retention requirement. The shared Playwright policy
retains screenshots/traces/videos on failure only; complete native browser visual
review remains independently OPEN.

At 909f5f1400a46c963f4cd23e07c0efbab4dfcb3c, the downloaded isolated closure
artifacts report 148 passed assertions in eighteen files, zero failed, skipped or
flaky. This includes the extended canonical store-product media projection check
and all twelve listing/moderation cases. Native owner/admin reads still require
the browser result; employee lifecycle cases belong to the next candidate.
