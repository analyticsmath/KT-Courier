# Driver document attachment integrity

Status: implemented transaction/API corrections; browser and full driver
acceptance remain open. All records and pixels below are disposable synthetic
fixtures. No document, driver, provider or production approval is represented.

The canonical attachment service now locks the driver before reading current
documents and checks the locked private-media record inside the transaction.
Evidence must be READY, owned by that driver and intended for the selected
document purpose. Licence evidence cannot reuse a headshot or identity upload;
vehicle evidence uses its separate endpoint. Replacement rejects every prior
current version atomically with creation of the new submitted version.

The unique media reference provides natural replay identity. Identical attachment
details return the existing record; altered type/expiry conflicts. Replay of
superseded evidence preserves its rejected status and never revives it. The UI
reports that actual status instead of claiming another submission. Documents
remain unapproved and the driver remains dispatch-ineligible.

GET/POST derive ownership from the session. The strict attachment schema rejects
supplied ownership fields. Typed expected failures return private 404/422/409
responses; unexpected domain failures return a static 503 without database or
provider messages. Document responses use private/no-store caching. Driver
document type/expiry controls have associated labels, and copy claims authorized
private access rather than an unverified storage encryption property.

Local PostgreSQL validation (`npm run test:integration:closure`, round 27b):
116 assertions across fifteen files passed, zero skipped, including all 23
driver profile/document assertions. New cases exercise actual attachment,
identity/licence purposes, mismatched/foreign/not-ready evidence, exact replay,
concurrent identical requests, concurrent replacements, superseded replay and
transaction rollback when replacement creation fails. The failure trigger is
limited to a generated disposable driver and removed in `finally`.

Eight executed API assertions cover role/origin/ownership/schema/privacy
responses. Targeted lint and TypeScript pass. The full unit/API run passed 3,434
assertions across 763 files; the final focused API/admin-UI run passed ten.
The optimized build with the final component/table source changes passed.

Two new executable browser assertions at 1440px and 390px perform actual PNG
upload, private download/decode, replacement, replay, reload and foreign/customer/
store/anonymous denial. A dedicated unapproved driver belongs to each viewport.
The disposable Compose override stores private files under a writable temporary
container directory; production storage selection and locks are unchanged.
Discovery selects 68 browser assertions across eighteen files. These two upload
assertions require exact-commit execution and actual capture inspection before
they can be counted as acceptance. PDF, vehicle, approval, live object storage,
real device and the complete driver journey still require proof.

At `53da89974f60775ec51747aacd3e424f772cf005`, main CI `37648243940`
passed. Certification `37648243933` passed all twenty PostgreSQL jobs,
quality, Redis/security and recovery. Browser job `112885086102` passed 66
assertions but failed both new upload assertions on both attempts; none were
skipped. Its phone failure capture was inspected and shows the static private
storage unavailable message with zero attached documents. The final certification
job did not run. This is failed acceptance, not a provider-only closure blocker.

The root correction supplies local raster storage only when all named disposable
browser database, runtime, network and temporary-directory guards pass. Production
is explicitly refused even when every test flag is supplied. Next's generated
standalone launcher overwrites NODE_ENV with production; a guarded browser-only
launcher now starts the same optimized server with test storage. The production
Docker command remains the generated launcher. Actual isolated browser execution
is required to prove upload and private download after this correction.

Round 28 local validation passed 3,450 unit/API assertions in 764 files and
122 actual PostgreSQL assertions in sixteen files, zero skipped. Sixteen new
storage-boundary assertions and five native launcher refusal assertions pass.
These results do not replace successful HTTP upload/browser proof.

At `9001252c8717474bcdd1ddb3278e55652d8f0a24`, upload, replacement and
rejected replay reached their assertions at both viewports, then private download
returned 503. Phone failure/retry captures show two documents and the truthful
REJECTED replay message. Both complete assertions failed; browser had 69 passes
and two failures, zero skipped.

The general read factory must select the same guarded disposable adapter as
raster intake: optimized compilation fixes direct NODE_ENV expressions to
production. Both factories now use the shared runtime-environment predicate;
boundary tests still require production refusal. Browser retries/repetitions use
fresh image bytes and assert growth relative to prior records without resetting
the database; identical-byte replay within each attempt remains required.

At `7816dc9112cc29a0d1d2a01d2d4fcea01736498c`, main CI `37656771607`
passed. Certification `37656771601` passed all twenty PostgreSQL jobs, quality,
Redis/security, recovery and browser job `112913707827`. All 74 selected browser
assertions passed in 2.4 minutes, zero skipped or flaky. The final certified job
failed on the recorded open engineering/production gates.

Both desktop/phone document replacement captures were actually viewed. They
show one submitted licence and one superseded rejected licence; the driver
remains profile-incomplete and not eligible. Actual private HTTP download/decode,
replacement/replay/reload and denial assertions passed. The phone rejected badge
wraps its last character onto a second line; the next candidate gives document
cards wrapping layout and keeps status badges intact. That visual correction
requires a fresh capture. PDF, vehicle, live storage and complete driver acceptance
remain open.

At `82a31f1355fab95c5a6dd1528d13d1936b9640bd`, all 79 Chromium assertions
pass (2.1 minutes, zero skipped/flaky). Both document replacement captures were
viewed. The phone badges now remain intact and sit below the wrapped file details;
the profile remains incomplete and not dispatch eligible. Complete driver/media
acceptance and live storage remain open.
