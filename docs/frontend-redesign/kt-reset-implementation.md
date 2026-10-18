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

Runtime verification: production deployment of 5f665f7 reached SUCCESS. Live 390px homepage, expanded menu, parcel, quote and footer were inspected, followed by desktop homepage/services and empty cart. Initial hero has no van; parcel and quote actions are visible without the former intro barrier. Browser navigation and menu closing were exercised. Full populated checkout/payment flow and complete device/reduced-motion matrix remain open; no self-issued 9/10 claim is made.

Independent source review rechecked all corrections and the new route shutter; no remaining concrete medium/high findings. No backend or protected catalog/dashboard file was modified.

Final checks: clean production build passed. 583 payment/checkout tests plus 32 public architecture/initial-content/route-boundary tests passed. Retired budget/accordion-only assertions were replaced with the new initial-content and service-answer contracts.

Live review corrections: use the existing right-facing freight profile with its true 1672×941 dimensions; fade the van only at entry, add a reading hold; loosen display tracking for word separation. Targeted lint, homepage typecheck and affected initial-content/boundary tests pass.


## Frontend correction pass — 18 October 2026

Latest client instructions supersede the earlier protected header/footer scope. Catalog body styling remains isolated, but the public header and footer are now shared. The header uses only the supplied logo, centered Shop / Send a parcel / Track links and a shopping-bag SVG. The catalog retains its 66px header clearance. The footer has a large single-line KT COURIERS wordmark, logo and grouped navigation on every public route.

The homepage no longer renders or fetches products. A three-image documentary opening leads to a contained van stage, four-frame local-life reel (pinned scroll travel on desktop; native horizontal scroll on mobile/reduced motion), contained freight scene and three service panels. Motion includes title entrance, image parallax, montage offsets, service-card reveals and wordmark reveal, with GSAP context cleanup. The vehicle image boxes are bounded by the stage height. Assets were visually inspected; filenames in the repository are not always faithful to their content.

Cart populated/loading roots and the primary checkout button no longer combine conflicting legacy padding/background classes. This fixes the source of header collision and white-on-white checkout text without modifying cart operations.

Validation: full TypeScript check, homepage TypeScript check, targeted ESLint, 20 relevant frontend assertions and clean production build (532 routes) passed. Source review identified and resolved the oversized van image risk. Deployed visual verification is recorded after publication.
