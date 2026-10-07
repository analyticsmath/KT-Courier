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
