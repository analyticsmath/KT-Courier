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
