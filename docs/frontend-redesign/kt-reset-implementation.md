# KT public reset implementation

Spec: kt-creative-reset-2026-10-18.md. Execute inline on main as explicitly directed by the client. No additional planning approval gate.

- [x] Isolate redesigned route styles from shop; build the new homepage with scene-local motion and no opening van.
- [x] Replace marketing header/menu/footer; preserve the legacy shell on shop routes.
- [x] Recompose services overview and service detail views with real media and early quote actions.
- [x] Recompose quote/tracking/auth and transaction presentation, preserving existing state machines.
- [x] Verify types, lint, production build and relevant checkout tests; independently review the final diff.
- [ ] Complete rendered desktop/mobile acceptance when the new deployment is reachable.
- [ ] Commit and push main as explicitly authorized.

Review focus: route transitions cannot leave fixed actors; direct/reverse/fast scroll; menu focus/scroll restoration; protected catalog appearance; transactional totals/validation unchanged.

Ruling: use the existing real-route component interfaces, without creating an alternate app or design route. The optional design-draft service returned no images and requires unrelated account setup; implement the client-approved replacement specification directly.

Engineering record: TypeScript, homepage typecheck and targeted ESLint pass. 583 existing payment/checkout tests and 11 route-family boundary cases pass. The final clean-cache production build passed after lifecycle fixes. Fresh source review found cart grid placement, menu history cleanup and preview decoding issues; all corrected.

Runtime limitation: both available browsers could not connect to the scratch development server. No new rendered desktop/mobile acceptance or 9/10 claim is made.

Independent source review rechecked all corrections and the new route shutter; no remaining concrete medium/high findings. No backend or protected catalog/dashboard file was modified.

Final checks: clean production build passed. 583 payment/checkout tests plus 32 public architecture/initial-content/route-boundary tests passed. Retired budget/accordion-only assertions were replaced with the new initial-content and service-answer contracts.
