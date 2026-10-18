# KT Couriers — replacement creative direction and rebuild plan

18 October 2026 · Valtum Studio · Target: `analyticsmath/KT-Courier`, `main`

Status: researched design proposal, ready for review. This document does not report an implemented redesign or visual acceptance. Baseline inspected: `8b7fcd89464a969435396ead572112a8427c9e93`.

## 1. The reset

The previous implementation retained the same page silhouettes and eight-chapter animation while changing their styling. That is insufficient. Replace the composition, navigation experience, public route art direction and homepage motion structure. Reuse selected media and working business behavior.

The latest client brief supersedes the earlier ONE PARCEL / MANY WORLDS direction. In particular:

- No van in the initial homepage viewport. It enters after deliberate scrolling.
- No requirement to retain the eight-step marketplace → packing → pickup → route → freight → handoff film.
- No blue interface wash, cream background, gradients, glow or glass.
- No differently colored words inside a heading. This also excludes gray-to-black word-by-word reading effects.
- No routine eyebrows, decorative rules, oversized category text at the ending or generic four-column footer.
- New menu, auth compositions, services and transaction layouts; recoloring existing components is not acceptance.
- Shop and all catalog descendants, dashboards, operational APIs and payment/order behavior remain protected.
- Work in the real repository on `main`. No demo app, lab route or replacement microsite.

## 2. Evidence from this inspection

### Current KT rendering and source

| Evidence | Finding | Required response |
| --- | --- | --- |
| Live homepage initial desktop viewport | Van overlaps the tagline and both primary actions; giant KT/COURIERS dominates behind it | Remove opening poster and replace the hero composition, rather than adjust van scale |
| `HeroScene.tsx` | An independent `data-hero-opening-poster` is always rendered | Retire that poster when replacing the hero; opacity zero alone leaves the old design architecture |
| `PublicHomeExperience.tsx` | Eight old scenes, multiple persistent layers and intro-controlled initialization remain active | Replace the active scene graph; do not mount old and new directors together |
| `home-chapters.ts` | Desktop budgets total 1,905vh; mobile budgets total 1,850vh | Replace budgets from a new sequence; mobile needs materially shorter native progression |
| Live `/services` | Repeated van/environment motif, mixed navy/blue title | Give service exploration a separate media composition and single-color typography |
| Live `/services/parcel` | First viewport is dominated by pale PARCEL lettering and courier cutout; booking is below | Show real service meaning and the quote action in the first viewport |
| `ParcelServiceView.tsx` | Occlusion intro precedes service information; Custody Protocol eyebrow and generic rules remain | Remove the intro barrier and rebuild the route structure |
| Same source | Claims about custody timestamps and confirmed delivery coordinates exceed the conservative registry copy | Remove unsupported operational claims; use the service registry as truth |
| Live `/quote` and utility stylesheet | Large mixed-color introductory heading and blue decorative divider push form downward | Compose the actual quote task as the opening viewport |
| Live expanded menu | Conventional narrow right drawer, sequential link list, decorative rules | Replace the spatial layout, hierarchy and opening/closing motion |
| Live login | Existing split-photo composition and additional inset image remain | Recompose around the form; remove the generic 50/50 marketing split |
| `EditorialFooter` and stylesheet | Separate generic CTA threshold followed by blue four-column directory | Build one authored footer; no duplicated homepage finale |
| Public typography stylesheet | `:root` font variables and an 800-weight heading default coexist with local overrides | Scope the new typography boundary and remove the need for override patches |
| `PublicVisualRoot` / public layout | Shop shares the same token, shell, header and footer boundary | Introduce a route-family boundary before changing shared tokens or shell behavior |

The observed symptoms establish composition failures. They do not establish the exact cause of every animation or home-return defect. Route lifecycle, decoding and scene ownership still need runtime diagnosis during replacement.

### Reference review: what was actually observed

This is selective desktop research, not a claim that every frame and route was audited. Existing Valtum corpus findings supplement the fresh inspection and are identified as such. A viewport override did not produce a confirmed phone-sized capture; mobile observations are not claimed as verified.

| Reference | Fresh evidence | Principle to adapt | Exclude |
| --- | --- | --- | --- |
| [United Carriers](https://unitedcarriers.com/) | Globe opening; transition to white editorial scene; crane lifting a container; truck becoming the next scale of transport, observed at several scroll positions | Give each object a clear physical task; large changes of scale and deliberate scene transitions | Blue glow, colored/gray headline fragments, statistics and global capabilities belonging to that business |
| [Aegis Sentinel](https://aegis-sentinel-tau.vercel.app/) | Large drone/type composition; drone becomes smaller within city and observation scenes; ending navigation. Source inspected in linked public repository | One object changes its role and relative scale across independently composed scenes | Copying the drone path, its palette, colored words or technical claims |
| [Math Intellect](https://math-intellect.vercel.app/) | Editorial type integrated with large photographic plane; image expansion before a quieter reading section | Media becomes the viewport, then yields to reading | Cream surface, orange action, contrast-color word treatment |
| [Personality Assessor](https://personality-analysis-exploiter.vercel.app/) | Laboratory field, inset image plane, oversized integrated type and following reading section | Depth can come from crop and layer geometry without a card grid | Dark theme, blue media treatment as interface palette, decorative reading-opacity effect |
| [Lando Norris](https://landonorris.com/) | Current opening portrait, race-related controls and sparse interface; longer route findings come from the existing corpus | Subject-specific information creates identity; a few strong visual ideas beat many effects | Neon palette, racing taxonomy, repeated loaders |
| [White Desert](https://white-desert.com/) | Environment fills the opening with integrated type/navigation; deeper pacing findings come from corpus | Let photography establish place; alternate immersive and quiet states | Gradients, decorative grid, serif contrast and long transition waits |
| [Oryzo](https://oryzo.ai/) | Current opening rendered successfully: object belongs on a coherent physical work surface | Believable context and object placement | Cork/cream palette and unrelated 3D production scope |
| [The Watch](https://thewatch.60fps.fr/) | Watch and broad typography rendered in opening, unlike the older corpus's blocked observation | Product-scale authority with restrained typography | Unsupported inference that the full WebGL experience is verified |
| [Siena](https://siena.film/) | Entry gate/striped opening only; navigation timed out | Existing corpus describes content-native navigation, but current interior is not verified | Treating an observed loader as proof of a complete interaction system |
| [Obys](https://obys.agency/) | Current spatial project index and vertical/horizontal/grid controls rendered | Media index can be an interaction surface rather than repeated cards | Copying its portfolio or large agency branding |

United Carriers' Awwwards page was inspected directly in the browser. It identifies the project as Site of the Day, 6 September 2026. Award recognition is reference context, not a KT quality certificate.

### Aegis source lesson

The linked `muzammil-codeverse/Aegis-Senital` source was cloned for read-only study. `showcase/story-motion.js` moves one existing drone stage rather than cloning it, measures positions against scene geometry, samples interpolated poses and uses GSAP quick setters. `editorial-motion.js` decodes incoming images before replacing them and rejects stale selection requests. These are useful ownership and loading principles, not code to paste wholesale into KT's Next.js lifecycle.

### Valtum rules read

The current master brain's structural, color, typography, footer, auth and QA rules were read alongside the reference corpus, Animation.docx and Design Elements.txt. Apply the current brief when it is stricter. No Playwright visual acceptance. No implementation self-score as proof of 9/10.

## 3. Chosen direction: an editorial world of movement

Three approaches were considered:

1. **Editorial movement with selective object choreography — recommended.** Strong photography and white space establish the business. Van and freight actors appear at selected transitions. Pages retain their own identity. Highest opportunity for distinctive composition without the old animation dependency chain.
2. **One continuous vehicle film.** Strong continuity but repeats the rejected structure, increases reverse-scroll and mobile complexity and risks making the website a film before it is useful.
3. **Documentary photography only.** Robust and credible but loses the valuable object library and the characteristic physical movement the client wants.

The recommendation has three connected ideas: **what people send → how it moves → where it arrives**. These are editorial ideas, not literal interface labels or three numbered process cards. The homepage does not pretend that one product invisibly passes through every photograph.

### Palette and typography

| Role | Proposed treatment |
| --- | --- |
| Main canvas | Pure white `#FFFFFF` |
| Secondary utility surface | Neutral gray `#F4F4F4`, used sparingly |
| Primary ink | `#191919` for complete headings and primary controls |
| Supporting copy | Neutral `#595959`; contrast checked at final size |
| Small functional signal | Deep red `#982C35`, derived from existing vehicle/uniform media; selected controls or validation only, never headline fragments |
| Photography | Natural asset color; no blanket blue filter or synthetic desaturation policy |
| Brand mark | Preserve the supplied logo, including its original blue; do not redraw or recolor it |

Use the already committed local Mona Sans variable font as the proposed public display/body family: 400 body, 500 controls, approximately 550–600 display. Test its actual widths with real KT text before freezing. Mono appears only for useful shipment references or technical data. No new font download required. Do not alter protected catalog/dashboard typography.

Hierarchy comes from line breaks, scale, placement and image relationships. Desktop hero type approximately 120–150px at 1440px; mobile approximately 52–64px at 390px, recomposed by content. These are starting design ranges, not unconditional CSS values.

## 4. New homepage: five compositions

Reference desktop board is 1440×900. Portrait board is 390×844. Coordinate descriptions define compositions to implement and compare; they are not claims that rendered boards already exist.

### H1 — opening: the human reason to send

Proposed headline: **From your hands. / To their door.** Entire heading is near-black. Supporting copy: “Arrange a parcel delivery or discover local stores with KT.” Real actions: Send a parcel; Shop local.

Desktop: compact masthead; wide two-line heading in the upper field; a substantial packing photograph begins below and toward the right, leaving a deliberate lower-left task area for copy/actions. Avoid a conventional 50/50 split. Use `/media/public/derived/photo-prep-workshop-dispatch-desk-1440w.webp`, whose actual packing subject was visually inspected. Keep the hands and parcel in the crop. No city photo faded under a giant wordmark. No opening van, curtain or hidden CTA.

Mobile: logo/menu row; complete heading; one concise line of explanatory copy and both useful actions; a portrait crop of the packing surface follows. Keep sending possible before any animated scene. The image may begin near the fold; the form/action must not be pushed below it by decorative media.

### H2 — first movement: van enters on scroll

Desktop: after roughly 0.3–0.45 viewport of deliberate scrolling, the opening media crop begins expanding and a separate white movement plane enters. The side-profile van travels left to right on this plane. It is a visual cut between editorial contexts, not a false seamless morph out of the packing photo. A short settled state lets visitors read the parcel-service proposition before the next scene overlaps.

Use `/media/public/protagonists/protagonist-van-side-right.webp`. Maintain the authored wheel baseline and visible alpha bounds. Asset orientation is already correct; do not mirror branded text. The road is optional only if camera perspective and ground contact agree. Do not place the side van over an incompatible street photograph.

At hero progress zero: van absent, not merely undecoded. At first-entry progress: visible partial silhouette enters from the edge. At hold: van and copy occupy separate safe regions. On reverse: return to the same complete opening without a residual actor.

Mobile: short native-scroll reveal of the side van within a contained white scene. No long pin and no pan that creates document overflow. Reduced motion: van appears as a contained illustration in this later section, never in the opening hero.

### H3 — things of different scale

Use an editorial field of real packing, retail and handoff photography. One image grows into the main field while the outgoing image remains briefly visible. A selected photograph can sit above another during the transition; this is a media-plane overlap, not a stack of feature cards.

Published catalog products can appear only when actual API presentation data provides them. Do not invent books or prices. If no catalog data is exposed, use the existing documentary media and a Shop link, without pretending it is a product listing.

Then change scale once: the existing red side-profile freight truck crosses a wider white composition. Let its physical length explain the change from parcels to larger-load services. No approach toward camera, yaw rotation sequence or mandatory top-down map. Its own red provides color without blue interface chrome.

### H4 — the right service, in its own world

A concise selection of parcel, business/e-commerce and freight content uses distinct image shapes and truthful short copy. An active service image takes over part of the composition as the visitor scrolls. Other capabilities remain available through All services; do not force eleven repeated feature cards onto the homepage.

Use text reveals by line translation/mask while maintaining one heading color. Add restrained inner-image parallax to photography, with enough overscan to prevent exposed edges. At least one transition changes composition substantially rather than applying another fade-up.

### H5 — arrival resolves into the footer

Use `/media/public/home/kt-home-13-arrival.webp` or `kt-home-10-handoff.webp` as the human conclusion, with the parcel and hands intact. A photographic mask reveals the arrival rather than replaying every courier/door frame. The old 12-frame sequence is optional only if its visual quality improves this scene; it is not a contractual chapter.

This composition feeds directly into the footer. No separate huge category/wordmark or repeated “Something to send?” CTA section. Footer utility becomes visible as the arrival image settles.

### Scroll allocation

Initial desktop target: roughly 8–11 viewport heights for the homepage before content-dependent footer length; at most two short pinned sequences. Mobile: roughly 6–8 viewport heights with native vertical progression and no prolonged pinning. Measure usefulness and rhythm in the rendered page; do not stretch a scene to hit these targets.

## 5. Motion contract

Smoothness is an observable property of continuity and response, not the presence of Lenis.

- One authoritative pose owner per actor. Scene-local controllers own local media. The van does not persist through every route or section.
- New homepage scene graph replaces `useHomeCinematicDirector` and its old chapter resolver in the active render tree. Retire unused source only after import/reference checks.
- Keep readable, valid initial HTML/CSS. Enhance after hydration; never hide all page content until a director reports readiness.
- Use one request-animation clock for Lenis and GSAP on eligible desktop marketing routes. The current provider already uses the GSAP ticker; fix timing where measured rather than stacking another smoother.
- Avoid a second large scrub delay on top of Lenis. Starting point: direct scrub for physical actors; modest eased travel defined within the timeline. Tune against wheel and trackpad response.
- Reveals: approximately 0.55–0.8 seconds, stagger no more than 0.06 seconds; each block readable without waiting for the entire page.
- Inner-image parallax: approximately 6–10% of the image height, with overscan. Keep forms and controls out of parallax ownership.
- Do not animate width/height every tick when transform/crop can express the composition. Measure geometry on setup/resize/font/media readiness, not unconditionally every frame.
- Decode incoming media; retain the previous valid image until the next is available. Ignore stale image-selection completions.
- Every important state must reconstruct from progress alone. Fast scroll may skip detail but cannot show a blank scene or duplicate actor.
- Revert only owned GSAP contexts/triggers/listeners on unmount. Never kill all ScrollTriggers globally or leave fixed actors attached to an outgoing route.
- Reduced motion is a different still composition with all content/actions, not a random frozen timeline.

Verify the new opening, first van entrance, service handoff and final resolution at 0/25/50/75/100% of each local transition, forwards and backwards. Ordinary unit tests can validate pure pose sampling if it is introduced; do not write tests that merely assert CSS choices.

## 6. Public routes must change their silhouettes

### Services overview

Open with “Find the right delivery.” plus an immediate parcel quote action. Use a large photographic/cargo composition, not the homepage van again. A sticky image field on desktop changes alongside service text in whitespace-led groups: everyday delivery, business requirements and larger movements. These are navigation groups, not promises of operational availability.

Use incoming media masks, outgoing image overlap and restrained movement of the relevant object. Every service remains an ordinary accessible link. Touch selection and keyboard focus must work without hover. Mobile uses authored vertical image/text groupings; no sticky hover-only preview or eleven identical image rows.

### `/services/parcel`: first priority after the homepage

Desktop first viewport: “Send a parcel.”, short truthful account/quote explanation, Get a quote and Track a delivery, and one strong packing/handoff image. No preliminary PARCEL billboard. The quote CTA appears before the decorative actor. Proposed support copy: “Get a quote without an account. Sign in when you’re ready to book.”

Follow with a packing image takeover, a useful preparation section from `service.preparation`, and a clear description of what the quote needs. The real registry process is describe request → both addresses → review/submit. Do not replace that business behavior with the old cinematic custody story.

Mobile first screen must show the title, explanation and quote action. Photography supports the task below it. A later small sticky quote action is allowed only if it clears bottom navigation and never duplicates an already visible main action.

### Other service details

| Route family | Primary material | Distinct motion/composition |
| --- | --- | --- |
| E-commerce/business | Merchant preparation and dispatch | Orders/media planes overlap; clear account/quote actions |
| Food/grocery | Existing food/produce imagery | Close crop opens into wider source context; no fabricated freshness guarantees |
| Pharmacy | Existing appropriate pharmacy media | Quiet detail-to-context reveal; handling confirmed during quote review |
| Moving/freight | Existing large-load media and truck | Lateral scale change, strong negative space, request details prominent |
| Shuttle | Existing transport context | Directional image movement, explicit availability language |
| Driver network | Existing human/vehicle media | Portrait/context relationship, real eligibility and application route |
| Pricing | Actual quote inputs and sourced explanation | Information composition; no invented price cards or animated sample fees |

Shared mechanics are reusable. Repeating the same hero, word cutout, process cards and gallery for every service is not.

### Quote

Replace the oversized promotional preamble with “Get a delivery quote.” and the real origin/destination fields in the opening composition. Desktop: useful form column and a quiet supporting parcel/detail region or summary where genuine data exists. Mobile: title and collection field first; single column; inputs 16px minimum; plain persistent labels and practical address guidance.

Preserve `PublicDeliveryQuoteForm` state/API semantics. Address autocomplete, map, parcel parameters, service availability and validation remain functional. The form should not inherit a marketing ScrollTrigger or transformed/sticky ancestor. No decorative blue rule. No invented fee, successful quote or route preview while empty.

### Tracking

Reference entry is the hero task. Use an optional restrained route motif outside the form. Empty, invalid, not found, unauthorized and authorized results remain distinct. Real timeline/map data is shown only after authorization. Do not stage editorial status as actual delivery progress.

### Login/signup

Compose an immediately usable form with a small, intentionally placed image fragment or parcel material beyond the form's reading region. No 50/50 full-height photo split, inset photo collage or marketing eyebrow. All labels, password reveal, errors, password-manager behavior, redirects and focus remain intact. On mobile, the form comes first and optional media follows or disappears. Scope changes to the public auth shell, not protected authentication behavior.

## 7. Navigation and footer

### Navigation

New full-viewport menu on marketing routes: a small consistent brand/close row, large but finite principal links on one side, a single changing media plane and practical secondary links elsewhere. White field, near-black type, no huge stacked categories competing in one line and no numbered decoration. On mobile, one column with complete reachable links; image can be reduced or omitted.

Opening: mask/plane expands, primary links reveal by line, photo settles. Closing reverses cleanly with a shorter duration. Initial timing target 450–650ms; navigation cannot wait for a long exit film. Escape, focus trapping, focus return, scroll locking and route-change close are mandatory.

Header geometry has one height token. Reserve actual layout space on ordinary routes; use deliberate overlay only in a composition designed for it. Never substitute `scroll-margin-top` for the fixed header's layout clearance.

### Footer

One footer surface containing the arrival resolution, useful next actions and compact utility. First region: final image/crop at a human scale with Send a parcel and Track links. Second region: small logo, deliberately grouped key routes, real contact where sourced, legal links, copyright and understated Made by Valtum Studio.

No giant wordmark or category string. No generic CTA band followed by another directory. No colored fragment of the footer headline, blue block, duplicate van or hairline decoration. All current necessary destinations remain reachable. Transaction and auth routes receive a compact utility variant rather than another cinematic ending.

## 8. Cart/checkout is a complete transaction composition

Use white, neutral gray, near-black controls and real product color. The proposed deep-red signal is secondary. Do not recolor prices/headline fragments or blue-tint every panel. Preserve ZAR formatting and all existing financial behavior.

Desktop cart: real merchandise occupies the principal area; grouped-store identity is clear; readable quantity/remove controls; stable order summary in a narrower column. Product rows use whitespace and useful object boundaries, not repeated decorative card shells.

Mobile cart: 88–104px merchandise image, full readable name, price, quantity control and remove control with 44px targets. One checkout total/action region. If fixed, it must reserve its own scroll clearance and sit safely above the existing bottom navigation; otherwise prefer an in-flow action over overlap.

The actual five-step controller remains contact → address → delivery choice → review → payment. Proposed stage design: compact textual progress with current and completed steps, focused stage heading, short form, one primary action, editable previous stages and a calm order summary. No decorative horizontal progress line or inaccessible future steps. Mobile progress can wrap rather than horizontally scroll.

Review must clearly show real store groups, fees, estimated/confirmed distinctions, tax and totals. Preserve Paystack redirects, digital/COD splitting, authorization, mutation order and idempotency. Reference subroutes remain genuine helper states; do not invent independent forms or fake successful payment pages.

Design and inspect: empty, loading, populated/multi-store, quantity pending/error, invalid contact/address, delivery repricing, unavailable service, review change, payment pending/failure/return/cancel/success. Populated purchase testing requires safe authorized test data; production payment is not a visual test.

## 9. Implementation boundaries and order

The new shell cannot change all `.public-v3-root` descendants indiscriminately. `/shop`, category/store/product/search descendants share public infrastructure today. Preserve them through an explicit protected route family which keeps their existing tokens, typography, menu/header/footer and transition behavior. Dashboards remain outside all changes.

| Work package | Source owners / planned work | Proof before moving on |
| --- | --- | --- |
| A. Scope boundary | Public layout, `PublicVisualRoot`, header/footer routing and font boundary | Protected catalog route behavior and appearance unchanged; header clearance correct |
| B. New static compositions | Homepage composition in real route, parcel, quote, menu and footer; remove conflicting active old scene imports | Both desktop and portrait layouts read coherently with all motion disabled |
| C. Homepage choreography | New scene-local timeline/pose modules; retire active old director and persistent layers | Initial van absent, lateral entrance, overlap states and reverse reconstruction correct |
| D. Service system | `PublicServicesOverview`, authored detail views and narrowly scoped motion primitives | Each family visibly distinct; parcel quote in first viewport; accurate copy |
| E. Utility/auth | Quote/track route compositions, form presentation, public auth shell | Input/error/focus/redirect behavior preserved; useful form visible early |
| F. Transactions | `CartExperience`, `CheckoutExperience`, `CheckoutStatePage` and transaction-only CSS | All real stages/states responsive; totals and payment contracts preserved |
| G. Integration | `PublicMotionProvider`, route transition owner, mobile navigation and media loading | Home → parcel → quote → home; back/forward, resize, fast/reverse scrolling, menu interruptions |

Do not ship a token-only package described as a redesign. Commit complete, reviewable route groups on `main` and record exactly which rendered states have been inspected. Do not remove old files solely because they look obsolete; prove they are unused first.

## 10. Acceptance and remaining evidence

### Reject immediately if

- Van is visible on initial home entry, including flash before hydration.
- Title, useful copy or action is occluded by an actor or fixed navigation.
- Heading contains differently colored words, routine eyebrow or decorative separator.
- A route has the old silhouette with a new palette and is described as redesigned.
- Menus, footer or public auth retain the rejected templates.
- Blank media, duplicate actors, wrong frame, exposed parallax edge or residual fixed layer appears during fast/reverse input.
- Shop/catalog typography, colors, navigation or dashboard UI changes incidentally.
- Build/test results are presented as visual acceptance or a self-issued 9/10 score.

### Manual matrix

320/360/390/430px portrait; tablet portrait/landscape; 1280/1440/1920 desktop. Inspect initial viewport, intermediate transition frames, menus, footer, parcel/quote, all transaction stages and auth. Use actual phone-sized rendering before claiming mobile verification. Test reduced motion, keyboard navigation, browser back/forward and return to home with both fresh and cached media.

Engineering checks: TypeScript, homepage typecheck if still relevant, targeted ESLint, production build and relevant existing non-Playwright checkout/payment tests. Read the installed Next.js documentation before production changes as required by `AGENTS.md`. No database migration, seeding, real order mutation or payment is needed for design work.

### What this research does not prove

No complete reference-site frame audit, confirmed mobile-browser audit, populated checkout purchase flow, runtime motion root-cause diagnosis, production deployment or finished redesign is claimed. The attempted optional hosted design-draft service required a separate sign-in and returned no candidate images; no mockup approval or generated design is claimed. That service is not a prerequisite for the source-grounded direction above.

Next concrete review object: this replacement composition/motion specification. Implementing it requires actual static production-route frames, followed by motion and rendered acceptance. The old art-direction documents are retained as historical source, not instructions to preserve the rejected story.
