# Candidate visual inspection

Source: commit `f7286c8af6f0fd4e8333339d830955983d3b4815`, certification
`37620687583`, successful `browser-evidence` artifact. The network-isolated
disposable browser captured seven actual application surfaces at 1440, 1366,
768 and 390 pixels, producing 28 full-page PNGs. Screens use synthetic fixtures,
not production customer or financial data. Four capture walks passed; this is
not complete visual or functional certification.

All 28 captures have now been viewed. The quote, product, catalog, wizard and
driver captures were inspected for viewport fit, readable labels and layout
defects. The long readiness captures were viewed as reduced full-page overviews;
these do not establish every field's legibility or focus behavior. Detailed
operator-page inspection remains open.

The baseline phone/tablet missing-media branch lacked the frame used by real
images and collapsed the neutral fallback to text. The product identity sat too
close to the mobile top controls. The repaired branch uses the existing image
frame; browser geometry, overflow and unchanged-cart assertions at 390px and
768px pass. Desktop fallback retains its expected gallery space.

The baseline catalog context panel broke "View live marketplace" into fragments
at 1366px and 1440px. Scoped header wrapping and an unbroken action repair this
panel. All four capture walks pass the one-readable-line assertion.

The short desktop product purchase panel uses its existing internal scroller.
A new 1366x768 browser assertion focuses the cart button, checks its viewport
bounds and hit target, submits with Enter and verifies the actual cart line.
It passed the earlier runs; a full-page capture alone cannot prove access. A
later first-attempt failure described below requires a fresh clean rerun.

At `caa8ca9ef01eb39f574fe3b96bf83fd203591f6d`, certification
`37625334615` executed all three new product assertions and all four responsive
capture walks successfully. Fresh phone/tablet fallback captures, the 1366px
catalog context panel and the focused short-desktop purchase capture have been
viewed: the fallback retains its image space and the marketplace link is readable
on one line. Keyboard focus revealed the desktop cart button inside the existing
scroller, its hit target was unobscured and Enter created the exact cart line.
The run passed 59 of 60 browser assertions, zero skipped; its independent
projection refusal test failed and requires a root error-policy correction.
These findings establish the scoped repairs, not complete visual acceptance.

The inspected catalog and driver forms fit their viewport with readable labels
and targets. Mobile catalog navigation uses a horizontal scroller; this is not
whole-document overflow. Fixed bottom navigation appears at its original viewport
position in full-page screenshots; screenshots alone do not prove focus targets
are unobscured during scrolling. Product media in this isolated fixture is absent,
so real image quality, multi-image behavior and live media delivery remain open.

Complete customer/vendor/driver/admin screens, all interactive/error states,
paid-order flows and provider-backed media acceptance still require review.

At `1d53a4e81387855de65ea1ec384248289b78c3e9`, certification `37635433735`
passed all 63 selected browser assertions, zero skipped, including the corrected
projection refusal and driver earnings eligibility/owner isolation. Six driver
captures were inspected: desktop/phone released records preserve the exact
amounts and readable history, and both restricted routes display clear eligibility
guidance with an unobscured onboarding focus ring. Real browser hit-target and
Enter navigation assertions pass for that onboarding link. These captures do not
certify every scroll position or history target.

At `4c928abfdd04673a4ea695d5cea4ea0ddccfe2ba`, certification `37638296003`
completed all three new driver finance-admin assertions on their first attempts.
Four desktop/phone detail and reconciliation captures were actually viewed:
amounts, history and safe reconciliation text were readable without document
overflow. Phone table keyboard scrolling passed, but list-table images were not
captured in that run. New list captures are added for the follow-up run.

The locked-reversal capture revealed that reviewer fields reset after a rejected
request. The follow-up changes the client form submission handler to retain input
and recover after network failure. Browser assertions now require both behaviors
and unchanged canonical records; fresh execution and visual review are pending.

That browser job had 65 clean passes and one cart-focus test that passed on retry,
zero skipped. Its actual failure image showed a clipped focus outline, and the
button bottom measured 768.609375px in a 768px viewport. The follow-up adds native
scroll padding and waits for scroll settlement while retaining strict viewport
and hit-target assertions. This run does not establish clean full acceptance.
Certification now rejects a nonzero flaky summary even when Playwright exits
zero. The local focused round-26 run failed during Docker image compilation with
a BuildKit RPC/EOF error before any browser assertions; it adds no browser proof.

At `1e90e48f00ea7a2d5b30eadcef43ed7cc0aee6c8`, all 66 browser assertions
passed in 2.5 minutes with zero skipped or flaky results. All ten desktop/phone
finance captures and the cart capture were viewed. Refusal and network-error
captures preserve reviewer fields with readable recovery guidance. The cart
viewport/hit-target/keyboard assertion passes; its screenshot after adding to
cart does not independently establish the earlier focus-ring position.

New list-table captures exposed split financial decimals and narrow references
and status codes, despite correct bounded scrolling. The follow-up keeps money
and status text intact and gives references readable widths while retaining the
keyboard scroll region. Those table changes, and the new driver private-document
upload states, require fresh exact-commit browser execution and actual inspection.
Full directed visual acceptance remains open.

At `53da89974f60775ec51747aacd3e424f772cf005`, the existing 66 browser
assertions passed and both new upload assertions failed. The desktop driver
earnings list and phone reconciliation list were actually inspected. Financial
decimals are intact; references wrap at readable widths. Later columns remain
inside the bounded horizontal scroll region. This is scoped inspection, not proof
that every column and focus state has been reviewed at every viewport.

The phone upload failure capture was inspected: a safe storage-unavailable
message and zero documents are visible. The guarded disposable raster adapter
and optimized test launcher correction require new browser execution and capture
inspection. Three store-owner earning assertions are newly executable and pending.

At `9001252c8717474bcdd1ddb3278e55652d8f0a24`, all three store-owner
assertions passed and all four desktop/phone list/detail captures were inspected.
Exact amounts, readable references, non-colour status labels and canonical release
history are visible. The phone detail full-page capture positions its fixed header
at the captured viewport; full scrolling/focus acceptance remains open.
Phone document failure/retry captures show two documents and truthful rejected
replay. Both complete assertions still failed on private download and require
the general read-factory correction. Three store-finance assertions and their
table/refusal/recovery captures require fresh execution and actual inspection.

At `7816dc9112cc29a0d1d2a01d2d4fcea01736498c`, all 74 Chromium assertions
passed in 2.4 minutes, zero skipped or flaky. Both driver document captures and
all ten store finance captures were actually viewed. Status/history and exact
money are readable; refusal/network recovery preserve reason/note. Horizontal
tables remain bounded and keyboard navigable, with later columns outside the
captured scroll position. Fixed headers in some full-page captures represent the
viewport position during capture. The phone document REJECTED badge splits its
last letter; wrapping cards and intact badges are corrected in the next candidate
and require a fresh capture. Complete directed visual acceptance remains open.

At `82a31f1355fab95c5a6dd1528d13d1936b9640bd`, all 79 Chromium assertions
passed, zero skipped/flaky. All twelve owner withdrawal captures and both document
captures were inspected. Exact balances, read-only masks and cancelled history are
readable; phone document badges remain intact. Fixed navigation placement in some
full-page driver captures does not certify every scroll/focus state. The next
candidate removes redundant last-four suffixes and distinguishes canonical history
events; finance captures and complete visual acceptance remain pending.

At `e63a1f3501b367b8debcff33007c734345e3f0eb`, all 82 Chromium assertions
pass, zero skipped/flaky. Twelve finance captures and eight updated owner
reserved/cancelled captures were actually inspected. Select labels no longer
repeat the last four and canonical history descriptions are distinguishable.
Finance money, masks, rejection release evidence and unresolved unknown outcome
are readable. Fixed navigation retained in full-page captures limits scroll/focus
claims. The phone destination withdrawal-reference row wraps its amount; the
next candidate separates it into an unbroken money span and requires new capture
review. Complete visual acceptance remains open.
At f45c3186084cc90b1a841f648137aba282d941a3, the phone payout-destination capture
was inspected: public references wrap and both ZAR 5.10 amounts stay intact beside
their status badges. Both first-failure catalog captures were also inspected;
they show the real validation summary and native type/category fields, but the
tests stop at an ambiguous alert selector before upload/save. These three inspected
captures do not establish full catalog, focus/scroll or overall visual acceptance.

At 42a0ecdfe7de8d749b86bc08177368628e01c6a2, the phone catalog category failure
capture was inspected. The downloaded accessibility snapshots expose the actual
`Electronics · /electronics` option; all four new catalog journeys stop before
writes because their expected option lacks the slash. None of the twelve planned
successful listing/review captures is established by this run. The phone capture
shows bounded native navigation and listing steps, but does not certify lower
form content or focus/scroll acceptance.

The current candidate removes successful-run screenshots from the selected
functional suites to follow the directive's failure-only evidence retention rule.
Automatic screenshot, trace and video retention remains limited to failures.
The viewport suite checks concrete heading/navigation/overflow semantics without
capturing passing runs. Historical artifact inspections recorded above remain
limited observations, not visual approval. Future full visual acceptance requires
actual native browser review at all four directed widths; it is still OPEN.

## Continuous Phase 2/3 authority and inspected evidence

The owner's 8 October 2026 continuous directive supersedes the historical failure-only capture restriction above. It explicitly requires actual inspection of relevant native screenshots. Successful critical-state screenshots are now captured in the isolated synthetic acceptance journeys; automatic trace/video retention remains failure-only. No production/customer/provider data is used.

Actually inspected d4a04088a514e202f38d1a1e3c1ea353328f9248 phone captures from certification 37828006758, browser-evidence artifact 11573505851: inventory-upload-390.png shows visible template/file/review controls, receipt feedback and readable stock cards; owned-replacement-390.png shows own order decisions, adjustment status and a truthful unavailable-map fallback. The tall trusted-parcel-admin-390.png was viewed as an overview: policy and measured-packaging inputs fit the narrow column, but that long capture does not establish every history field's legibility or every focus/scroll state. Catalog's horizontal tab strip is intentional bounded navigation, not whole-document overflow.

Customer delivery completion and driver phone captures from the same SHA show readable delivered/POD/status content. They also exposed false empty chat after reload despite two durable messages. The next source fixes owned-thread hydration and requires native customer/driver reload assertions plus chat captures. Previous f8c732ba branding/store-order phone and 8261bcf customer-avatar/driver inspections remain historical scoped evidence, not acceptance of another source. New wallet/refund/finance, admin reconciliation and ready-order captures still require actual execution and inspection. Independent visual/device acceptance remains BLOCKED_EXTERNAL; the manifest visual gate stays OPEN.
