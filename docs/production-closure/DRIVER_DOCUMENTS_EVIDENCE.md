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
