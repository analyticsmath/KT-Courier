# KT Courier homepage cinematic implementation report

## A. Baseline

- Branch: `main`
- HEAD before edits: `56a185551ebda6f128007adea79834ab51dbd04c`
- Working tree before edits: clean; no tracked changes or untracked files.

## B. Raw asset inventory

All listed images have an alpha channel. Original PNG masters remain under the existing ignored `/public/media/public/images/` path. The directive named `red_tuck_top.*`; the only supplied top-down red truck was `red_truck_top.png`, which the user explicitly approved.

### KT_BOX_SEQUENCE_8_FRAMES — 8 images

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `box_00_open_master.png` | 512×512 | yes | 186,663 |
| `box_01_side_flaps_early.png` | 512×512 | yes | 177,856 |
| `box_02_side_flaps_mid.png` | 512×512 | yes | 170,169 |
| `box_03_side_flaps_closed.png` | 512×512 | yes | 161,355 |
| `box_04_rear_flap_early.png` | 512×512 | yes | 150,728 |
| `box_05_rear_flap_near_closed.png` | 512×512 | yes | 139,747 |
| `box_06_front_flap_mid.png` | 512×512 | yes | 139,891 |
| `box_07_closed.png` | 512×512 | yes | 127,980 |

### KT_Courier_White_Van_Courier_Performance_Pack / pickup A — 17 images

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `pickup_A00_van_closed_right.png` | 2048×2048 | yes | 872,177 |
| `pickup_A01_door_15.png` | 2048×2048 | yes | 881,992 |
| `pickup_A02_door_35.png` | 2048×2048 | yes | 897,062 |
| `pickup_A03_door_60.png` | 2048×2048 | yes | 905,297 |
| `pickup_A04_door_85.png` | 2048×2048 | yes | 918,797 |
| `pickup_A05_door_open.png` | 2048×2048 | yes | 935,302 |
| `pickup_A06_courier_approach_box.png` | 2048×2048 | yes | 1,031,420 |
| `pickup_A07_courier_at_door.png` | 2048×2048 | yes | 1,040,226 |
| `pickup_A08_load_start.png` | 1254×1254 | yes | 852,124 |
| `pickup_A09_load_half.png` | 1254×1254 | yes | 844,596 |
| `pickup_A10_load_near_inside.png` | 1254×1254 | yes | 842,981 |
| `pickup_A11_parcel_released.png` | 1254×1254 | yes | 841,543 |
| `pickup_A12_courier_withdraw.png` | 1254×1254 | yes | 885,977 |
| `pickup_A13_courier_clear.png` | 1254×1254 | yes | 880,603 |
| `pickup_A14_door_closing_60.png` | 2048×2048 | yes | 905,297 |
| `pickup_A15_door_closing_25.png` | 2048×2048 | yes | 891,910 |
| `pickup_A16_ready_depart.png` | 2048×2048 | yes | 872,177 |

### KT_COURIER_WHITE_VAN_TOP_DOWN_SEQUENCE — 7 images

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `van_road_01_right.png` | 1254×1254 | yes | 617,113 |
| `van_road_02_turn_15.png` | 1254×1254 | yes | 747,562 |
| `van_road_03_turn_30.png` | 1254×1254 | yes | 945,468 |
| `van_road_04_turn_45.png` | 1254×1254 | yes | 1,090,786 |
| `van_road_05_turn_60.png` | 1254×1254 | yes | 972,202 |
| `van_road_06_turn_75.png` | 1254×1254 | yes | 694,408 |
| `van_road_07_down.png` | 1254×1254 | yes | 647,086 |

### KT_Courier_White_Van_Courier_Performance_Pack / delivery B — 12 images

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `delivery_B00_van_closed_left.png` | 2048×2048 | yes | 865,404 |
| `delivery_B01_door_15.png` | 2048×2048 | yes | 875,140 |
| `delivery_B02_door_35.png` | 2048×2048 | yes | 890,426 |
| `delivery_B03_door_60.png` | 2048×2048 | yes | 900,412 |
| `delivery_B04_door_85.png` | 2048×2048 | yes | 912,921 |
| `delivery_B05_door_open.png` | 2048×2048 | yes | 930,665 |
| `delivery_B06_courier_emerging.png` | 1254×1254 | yes | 804,209 |
| `delivery_B07_courier_threshold_box.png` | 1254×1254 | yes | 774,438 |
| `delivery_B08_courier_out_box.png` | 1254×1254 | yes | 787,609 |
| `delivery_B09_walk_right_01.png` | 2048×2048 | yes | 1,045,984 |
| `delivery_B10_walk_right_02.png` | 2048×2048 | yes | 1,041,361 |
| `delivery_B11_handoff_entry_match.png` | 2048×2048 | yes | 1,083,800 |

### KT_COURIER_HANDOFF_12_PNGS — 12 images

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `handoff_01_approach.png` | 1254×1254 | yes | 998,920 |
| `handoff_02_arrival.png` | 1254×1254 | yes | 976,289 |
| `handoff_03_recipient_reach.png` | 1254×1254 | yes | 991,909 |
| `handoff_04_first_contact.png` | 1254×1254 | yes | 984,826 |
| `handoff_05_shared_parcel.png` | 1254×1254 | yes | 1,000,925 |
| `handoff_06_weight_transfer.png` | 1254×1254 | yes | 1,008,397 |
| `handoff_07_release.png` | 1254×1254 | yes | 1,027,361 |
| `handoff_08_withdrawal.png` | 1254×1254 | yes | 1,009,225 |
| `handoff_09_separation_begin.png` | 1254×1254 | yes | 1,032,890 |
| `handoff_10_departure_step.png` | 1254×1254 | yes | 1,019,958 |
| `handoff_11_walking_apart.png` | 1254×1254 | yes | 906,282 |
| `handoff_12_final_separation.png` | 1254×1254 | yes | 848,878 |

### KT_Courier_White_Van_Courier_Performance_Pack / return C — 7 images

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `return_C01_walk_left.png` | 1254×1254 | yes | 774,124 |
| `return_C02_approach_van.png` | 1254×1254 | yes | 769,414 |
| `return_C03_enter_van.png` | 1254×1254 | yes | 792,460 |
| `return_C04_inside.png` | 2048×2048 | yes | 930,665 |
| `return_C05_door_closing_60.png` | 2048×2048 | yes | 900,412 |
| `return_C06_door_closing_25.png` | 2048×2048 | yes | 884,995 |
| `return_C07_departure_ready.png` | 2048×2048 | yes | 865,404 |

### approved road — 1 image

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `road.png` | 1671×941 | yes | 552,221 |

### approved red top truck — 1 image

| Source filename | Original canvas | Alpha | Raw bytes |
|---|---:|:---:|---:|
| `red_truck_top.png` | 1254×1254 | yes | 547,488 |

The pickup, delivery and return packs mix 2048×2048 and 1254×1254 source canvases. The pipeline centers each complete 1254px canvas in a transparent 2048px canvas before uniform resizing. This preserves all source pixels and their internal placement; no frame is trimmed or recentered around a person. Engineering contact sheets were inspected for order and registration.

## C. Generated runtime assets

- Root: `public/media/public/home-cinematic/`
- Families: `box/`, `performance/`, `route-van/`, `handoff/`, `environment/`, `freight/`
- Every one of the 65 runtime states has desktop and mobile WebP derivatives.
- Generated typed manifest: `components/public-v3/home/data/home-cinematic-assets.generated.ts`
- Derivatives preserve alpha; actor WebPs use quality 91, alpha quality 100, effort 6.

| Family | States | Desktop + mobile bytes |
|---|---:|---:|
| box | 8 | 427,740 |
| pickup | 17 | 2,430,858 |
| route-van | 7 | 1,167,396 |
| delivery | 12 | 1,641,038 |
| handoff | 12 | 3,462,080 |
| return | 7 | 993,276 |
| road | 1 | 122,010 |
| red-truck-top | 1 | 173,852 |
| **Total** | **65** | **10,418,250** |

## D. Files changed

- `components/public-v2/commerce/CategoryOrbitSpinner.tsx`
- `components/public-v2/commerce/category-orbit-geometry.ts`
- `components/public-v3/home/PublicHomeExperience.tsx`
- `components/public-v3/home/actors/PersistentHomeCinematicLayer.tsx`
- `components/public-v3/home/actors/home-cinematic-preload.ts`
- `components/public-v3/home/actors/home-cinematic-runtime.ts`
- `components/public-v3/home/data/home-cinematic-assets.generated.ts`
- `components/public-v3/home/director/home-beats.ts`
- `components/public-v3/home/director/home-chapters.ts`
- `components/public-v3/home/director/home-cinematic-frame-resolver.ts`
- `components/public-v3/home/director/home-frame-resolver.ts`
- `components/public-v3/home/director/useHomeCinematicDirector.ts`
- `components/public-v3/home/home-cinematic.module.css`
- `components/public-v3/home/home-scenes.module.css`
- `components/public-v3/home/post-hero-rebuild.module.css`
- `components/public-v3/home/scenes/CollectionPickupScene.tsx`
- `components/public-v3/home/scenes/HomeCinematicScenes.tsx`
- `components/public-v3/home/scenes/index.ts`
- `scripts/media/prepare-home-cinematic-assets.mjs`
- `package.json`
- `tsconfig.home-cinematic.json`
- `tests/home/hero-van-frame-resolver.test.ts`
- `tests/home/home-actor-image-readiness.test.ts`
- `tests/home/home-cinematic-frame-resolver.test.ts`
- `tests/home/home-frame-resolver.test.ts`
- `tests/home/home-mobile-hero-geometry.test.ts`
- `tests/home/post-hero-correction-contract.test.ts` (removed obsolete retired-bank assertions)
- `tests/home/post-hero-v5-contract.test.ts` (removed obsolete retired-bank assertions)
- `tests/home/post-hero-v6-contract.test.ts` (removed obsolete retired-bank assertions)
- `public/media/public/home-cinematic/box/` (16 generated WebPs)
- `public/media/public/home-cinematic/performance/` (72 generated WebPs)
- `public/media/public/home-cinematic/route-van/` (14 generated WebPs)
- `public/media/public/home-cinematic/handoff/` (24 generated WebPs)
- `public/media/public/home-cinematic/environment/` (2 generated WebPs)
- `public/media/public/home-cinematic/freight/` (2 generated WebPs)

The generated manifest records each derivative's exact path and its source filename. Raw PNG masters remain ignored and untracked.

## E. Narrative ownership

| Chapter | Motion owner and physical seam |
|---|---|
| Hero → Commerce | Terminal Hero van stays opaque; the white Marketplace plane rises from below and hides it only after full coverage. |
| Commerce | Scroll-driven five-face KT orbit unfolds into large category media, then actual new-arrival products stack and fan. The selected product passes to one fixed carry image. |
| Parcelization | The same product descends behind an open-box foreground wall. Eight box states close the parcel. |
| Pickup | Combined A performance frames stage left-to-right arrival, door movement, loading, withdrawal, closure and departure; the van crosses the box before the box retires. |
| Network | The approved transparent road and generated top-down van share one transformed camera world. Route points, tangent buckets and camera anchoring are pure functions. |
| Freight | The approved red top-down truck moves left-to-right across the boundary; its trailing position drives the Freight clip reveal. |
| Last mile | Combined B performance frames arrive right-to-left. All twelve combined handoff frames play in order, followed by the C return and door-close frames, then leftward departure. |
| Finale | DELIVERED. holds, then KT / COURIER, motto, utility links and legal copy resolve. |

## F. Mobile

The Hero cover, orbit, category territory, product fan, box closure, pickup, route camera, truck reveal, handoff, return and finale remain authored. The category territory is a native horizontal snap rail; the orbit and fan use smaller perspective geometry. Performance stages crop intentionally around the cargo door and people. The route uses a moving camera over the full road composition. Finale links and legal text clear the persistent mobile navigation.

## G. Validation

- `npm run media:home:cinematic`: passed; generated 65 states / 130 derivatives.
- `npm run typecheck:home`: passed.
- `npx vitest run tests/home/`: passed (8 files, 43 tests).
- `npm run build`: passed; Next reported successful compilation and 476 static pages. Next skipped project-wide type validation.
- `npm run lint`: blocked by pre-existing errors in `PublicMotionProvider.tsx`, `tests/public-v2/commerce-perfection.test.ts`, and malformed `tests/services/payment-provider-session.service.test.ts`. Targeted lint of changed homepage files passed.
- `npm run typecheck`: blocked by malformed generated `.next/dev/types/routes.d.ts`, `.next/dev/types/validator.ts`, and the unrelated payment test.
- No Playwright, automated browser screenshot campaign, deployment or visual self-approval was performed.

## H. Known limitations

- Creative visual acceptance is pending. The contact sheets validate frame order and registration but do not establish final on-screen art direction.
- The live product carry requires actual `home.newArrivals` data. When the storefront has no published products, the homepage offers a Shop link and cannot show a fabricated continuity product.
- The source performance pack has mixed original canvas sizes; the documented transparent padding resolves runtime scale continuity without altering source files.

## I. Visual review status

Technical implementation is ready for separate creative visual review.
