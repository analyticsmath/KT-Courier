/**
 * KT Courier Public Experience — Actor State Machine
 *
 * Strongly typed definitions for all 62 pre-rendered performance states.
 * Enforces orientation continuity, intrinsic ratios, and concealment rules.
 * Visible crossfades in unobstructed viewports are strictly forbidden.
 */

export type ConcealmentStrategy =
  | "typography-occlusion"
  | "trailer-takeover"
  | "camera-crop"
  | "road-geometry"
  | "door-sequence"
  | "scene-boundary";

export interface ActorStateDefinition {
  id: string;
  name: string;
  webpSrc: string;
  pngSrc: string;
  alt: string;
  width: number;
  height: number;
  aspectRatio: number;
  orientation: "right" | "left" | "center" | "top-down" | "detail";
  allowedTransitionsIn?: string[];
  allowedTransitionsOut?: string[];
  concealment: ConcealmentStrategy;
}

// ---------------------------------------------------------------------------
// White Truck — 16 States (Flagship Long-Haul Transport)
// ---------------------------------------------------------------------------
export type WhiteTruckStateId =
  | "wide-hero" // 10: Primary campaign hero composition
  | "side-right" // 01
  | "side-left" // 02
  | "centered-hero" // 03: Settled profile hold
  | "front-3q-right" // 04
  | "front-3q-left" // 05
  | "rear-3q-right" // 06
  | "rear-3q-left" // 07
  | "top-down-straight" // 08
  | "top-down-angled" // 09
  | "front-cab-close" // 11
  | "cargo-box-close" // 12
  | "rear-portion-close" // 13
  | "rear-doors-open" // 14
  | "motion-energy" // 15: Acceleration state
  | "top-down-turning"; // 16

export const WHITE_TRUCK_STATES: Record<WhiteTruckStateId, ActorStateDefinition> = {
  "wide-hero": {
    id: "wide-hero",
    name: "10_oversized_wide_hero_composition",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-oversized-wide-hero-composition.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-oversized-wide-hero-composition.png",
    alt: "KT Couriers white freight truck hero profile across typography",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "right",
    concealment: "scene-boundary",
  },
  "side-right": {
    id: "side-right",
    name: "01_full_side_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-side-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-side-right.png",
    alt: "KT Couriers white truck full side view facing right",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "right",
    concealment: "typography-occlusion",
  },
  "side-left": {
    id: "side-left",
    name: "02_full_side_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-side-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-side-left.png",
    alt: "KT Couriers white truck full side view facing left",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "left",
    concealment: "typography-occlusion",
  },
  "centered-hero": {
    id: "centered-hero",
    name: "03_centered_hero_side_view",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-centered-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-centered-hero.png",
    alt: "KT Couriers white truck centered side hold",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "center",
    concealment: "typography-occlusion",
  },
  "front-3q-right": {
    id: "front-3q-right",
    name: "04_front_three_quarter_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-right.png",
    alt: "KT Couriers white truck front three quarter view right",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "right",
    concealment: "road-geometry",
  },
  "front-3q-left": {
    id: "front-3q-left",
    name: "05_front_three_quarter_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-front-3q-left.png",
    alt: "KT Couriers white truck front three quarter view left",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "left",
    concealment: "road-geometry",
  },
  "rear-3q-right": {
    id: "rear-3q-right",
    name: "06_rear_three_quarter_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-rear-three-quarter-view-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-rear-three-quarter-view-facing-right.png",
    alt: "KT Couriers white truck rear three quarter view right",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "right",
    concealment: "road-geometry",
  },
  "rear-3q-left": {
    id: "rear-3q-left",
    name: "07_rear_three_quarter_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-rear-three-quarter-view-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-rear-three-quarter-view-facing-left.png",
    alt: "KT Couriers white truck rear three quarter view left",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "left",
    concealment: "road-geometry",
  },
  "top-down-straight": {
    id: "top-down-straight",
    name: "08_top_down_view",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-top-down-straight.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-top-down-straight.png",
    alt: "KT Couriers white truck overhead top down route view",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "top-down",
    concealment: "road-geometry",
  },
  "top-down-angled": {
    id: "top-down-angled",
    name: "09_top_down_angled_straight_road",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-top-down-angled-straight-road.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-top-down-angled-straight-road.png",
    alt: "KT Couriers white truck angled top down approach",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "top-down",
    concealment: "road-geometry",
  },
  "front-cab-close": {
    id: "front-cab-close",
    name: "11_close_crop_front_cab_only",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-close-crop-front-cab-only.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-close-crop-front-cab-only.png",
    alt: "KT Couriers white truck driver cab close crop",
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "cargo-box-close": {
    id: "cargo-box-close",
    name: "12_close_crop_long_cargo_box_only",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-cargo-box-material.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-cargo-box-material.png",
    alt: "KT Couriers white truck cargo box side panel",
    width: 1400,
    height: 800,
    aspectRatio: 1.75,
    orientation: "detail",
    concealment: "trailer-takeover",
  },
  "rear-portion-close": {
    id: "rear-portion-close",
    name: "13_close_crop_rear_portion_only",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-close-crop-rear-portion-only.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-close-crop-rear-portion-only.png",
    alt: "KT Couriers white truck cargo rear door close crop",
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "rear-doors-open": {
    id: "rear-doors-open",
    name: "14_rear_doors_slightly_open",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-rear-doors-slightly-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-rear-doors-slightly-open.png",
    alt: "KT Couriers white truck rear cargo doors slightly open",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "detail",
    concealment: "door-sequence",
  },
  "motion-energy": {
    id: "motion-energy",
    name: "15_subtle_motion_energy",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-subtle-motion-energy.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-subtle-motion-energy.png",
    alt: "KT Couriers white truck accelerating into motion",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "right",
    concealment: "typography-occlusion",
  },
  "top-down-turning": {
    id: "top-down-turning",
    name: "16_top_down_turning_curve_transition",
    webpSrc: "/media/public/protagonists/protagonist-truck-white-top-down-turning.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-white-top-down-turning.png",
    alt: "KT Couriers white truck turning along highway curve",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "top-down",
    concealment: "road-geometry",
  },
};

// ---------------------------------------------------------------------------
// Courier — 20 States (Human Protagonist)
// ---------------------------------------------------------------------------
export type CourierStateId =
  | "walk-right-one-parcel" // 04
  | "walk-left-one-parcel" // 05
  | "look-right-approach" // 10
  | "look-left-approach" // 11
  | "lift-parcel" // 13
  | "place-parcel" // 12
  | "loading-unloading" // 18
  | "ready-handover" // 07
  | "extending-handoff" // 08
  | "look-viewer-parcel" // 09
  | "portrait-upper-body" // 20
  | "hero-standing" // 01
  | "full-body-one-parcel" // 02
  | "full-body-two-parcels" // 03
  | "walk-two-parcels" // 06
  | "small-parcel-one-hand" // 14
  | "medium-box-arm" // 15
  | "empty-hands-hero" // 16
  | "forward-gesture" // 17
  | "half-body-holding"; // 19

export const COURIER_STATES: Record<CourierStateId, ActorStateDefinition> = {
  "walk-right-one-parcel": {
    id: "walk-right-one-parcel",
    name: "04_walking_one_parcel_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walk-right-one-parcel.png",
    alt: "KT courier carrying package walking right",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "right",
    concealment: "scene-boundary",
  },
  "walk-left-one-parcel": {
    id: "walk-left-one-parcel",
    name: "05_walking_one_parcel_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-courier-walking-one-parcel-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walking-one-parcel-facing-left.png",
    alt: "KT courier carrying package walking left",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "left",
    concealment: "scene-boundary",
  },
  "look-right-approach": {
    id: "look-right-approach",
    name: "10_looking_right_approaching_vehicle",
    webpSrc: "/media/public/protagonists/protagonist-courier-approach-vehicle.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-approach-vehicle.png",
    alt: "KT courier approaching delivery vehicle looking right",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "right",
    concealment: "door-sequence",
  },
  "look-left-approach": {
    id: "look-left-approach",
    name: "11_looking_left_approaching_vehicle",
    webpSrc: "/media/public/protagonists/protagonist-courier-looking-left-approaching-vehicle.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-looking-left-approaching-vehicle.png",
    alt: "KT courier approaching delivery vehicle looking left",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "left",
    concealment: "door-sequence",
  },
  "lift-parcel": {
    id: "lift-parcel",
    name: "13_lifting_parcel_up",
    webpSrc: "/media/public/protagonists/protagonist-courier-lifting-parcel-up.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-lifting-parcel-up.png",
    alt: "KT courier lifting packed parcel",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "door-sequence",
  },
  "place-parcel": {
    id: "place-parcel",
    name: "12_placing_parcel_down",
    webpSrc: "/media/public/protagonists/protagonist-courier-placing-parcel-down.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-placing-parcel-down.png",
    alt: "KT courier setting package down at delivery point",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "loading-unloading": {
    id: "loading-unloading",
    name: "18_loading_unloading_parcel",
    webpSrc: "/media/public/protagonists/protagonist-courier-loading-unloading.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-loading-unloading.png",
    alt: "KT courier staging parcel into vehicle",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "right",
    concealment: "door-sequence",
  },
  "ready-handover": {
    id: "ready-handover",
    name: "07_ready_to_handover_parcel",
    webpSrc: "/media/public/protagonists/protagonist-courier-ready-handover.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-ready-handover.png",
    alt: "KT courier holding parcel ready for custody transfer",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "extending-handoff": {
    id: "extending-handoff",
    name: "08_extending_parcel_for_handoff",
    webpSrc: "/media/public/protagonists/protagonist-courier-extending-handoff.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-extending-handoff.png",
    alt: "KT courier extending parcel forward for doorstep handover",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "look-viewer-parcel": {
    id: "look-viewer-parcel",
    name: "09_looking_toward_viewer_with_parcel",
    webpSrc: "/media/public/protagonists/protagonist-courier-looking-toward-viewer-with-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-looking-toward-viewer-with-parcel.png",
    alt: "KT courier standing with parcel looking toward camera",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "portrait-upper-body": {
    id: "portrait-upper-body",
    name: "20_close_crop_upper_body_portrait",
    webpSrc: "/media/public/protagonists/protagonist-courier-close-crop-upper-body-portrait.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-close-crop-upper-body-portrait.png",
    alt: "KT courier portrait close crop",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "camera-crop",
  },
  "hero-standing": {
    id: "hero-standing",
    name: "01_original_pose_refined",
    webpSrc: "/media/public/protagonists/protagonist-courier-hero-standing.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-hero-standing.png",
    alt: "KT courier standing confident hero pose",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "full-body-one-parcel": {
    id: "full-body-one-parcel",
    name: "02_full_body_one_parcel",
    webpSrc: "/media/public/protagonists/protagonist-courier-carry-one-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-carry-one-parcel.png",
    alt: "KT courier full body standing with box",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "full-body-two-parcels": {
    id: "full-body-two-parcels",
    name: "03_full_body_two_parcels",
    webpSrc: "/media/public/protagonists/protagonist-courier-full-body-two-parcels.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-full-body-two-parcels.png",
    alt: "KT courier holding two boxes",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "walk-two-parcels": {
    id: "walk-two-parcels",
    name: "06_walking_two_parcels",
    webpSrc: "/media/public/protagonists/protagonist-courier-walking-two-parcels.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-walking-two-parcels.png",
    alt: "KT courier walking with two delivery parcels",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "right",
    concealment: "scene-boundary",
  },
  "small-parcel-one-hand": {
    id: "small-parcel-one-hand",
    name: "14_small_parcel_one_hand",
    webpSrc: "/media/public/protagonists/protagonist-courier-small-parcel-one-hand.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-small-parcel-one-hand.png",
    alt: "KT courier holding small package in one hand",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "medium-box-arm": {
    id: "medium-box-arm",
    name: "15_medium_box_under_arm",
    webpSrc: "/media/public/protagonists/protagonist-courier-medium-box-under-arm.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-medium-box-under-arm.png",
    alt: "KT courier holding medium box under arm",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "empty-hands-hero": {
    id: "empty-hands-hero",
    name: "16_empty_hands_courier_hero",
    webpSrc: "/media/public/protagonists/protagonist-courier-empty-hands-courier-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-empty-hands-courier-hero.png",
    alt: "KT courier ready standing hero",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "forward-gesture": {
    id: "forward-gesture",
    name: "17_forward_gesture_with_parcel",
    webpSrc: "/media/public/protagonists/protagonist-courier-forward-gesture-with-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-forward-gesture-with-parcel.png",
    alt: "KT courier gesturing forward with box",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "half-body-holding": {
    id: "half-body-holding",
    name: "19_half_body_holding_parcel",
    webpSrc: "/media/public/protagonists/protagonist-courier-half-body-holding-parcel.webp",
    pngSrc: "/media/public/protagonists/protagonist-courier-half-body-holding-parcel.png",
    alt: "KT courier half body carrying delivery",
    width: 800,
    height: 1200,
    aspectRatio: 800 / 1200,
    orientation: "center",
    concealment: "camera-crop",
  },
};

// ---------------------------------------------------------------------------
// Van — 14 States (Local Urban Collection & Street Movement)
// ---------------------------------------------------------------------------
export type VanStateId =
  | "side-right" // 01
  | "side-left" // 02
  | "front-3q-right" // 03
  | "front-3q-left" // 04
  | "rear-3q-right" // 05
  | "rear-3q-left" // 06
  | "centered-hero" // 07
  | "front-half-close" // 08
  | "rear-half-close" // 09
  | "sliding-door-open" // 10
  | "rear-doors-open" // 11
  | "all-doors-open" // 12
  | "motion-transition"; // 13

export const VAN_STATES: Record<VanStateId, ActorStateDefinition> = {
  "side-right": {
    id: "side-right",
    name: "01_full_side_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-van-side-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-side-right.png",
    alt: "KT Couriers local delivery van side view facing right",
    width: 1400,
    height: 800,
    aspectRatio: 1400 / 800,
    orientation: "right",
    concealment: "door-sequence",
  },
  "side-left": {
    id: "side-left",
    name: "02_full_side_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-van-full-side-view-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-full-side-view-facing-left.png",
    alt: "KT Couriers delivery van side view facing left",
    width: 1400,
    height: 800,
    aspectRatio: 1400 / 800,
    orientation: "left",
    concealment: "door-sequence",
  },
  "front-3q-right": {
    id: "front-3q-right",
    name: "03_front_three_quarter_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-right.png",
    alt: "KT Couriers van front 3/4 view facing right",
    width: 1400,
    height: 900,
    aspectRatio: 1400 / 900,
    orientation: "right",
    concealment: "scene-boundary",
  },
  "front-3q-left": {
    id: "front-3q-left",
    name: "04_front_three_quarter_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-front-three-quarter-facing-left.png",
    alt: "KT Couriers van front 3/4 view facing left",
    width: 1400,
    height: 900,
    aspectRatio: 1400 / 900,
    orientation: "left",
    concealment: "scene-boundary",
  },
  "rear-3q-right": {
    id: "rear-3q-right",
    name: "05_rear_three_quarter_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-van-rear-three-quarter-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-rear-three-quarter-facing-right.png",
    alt: "KT Couriers van rear 3/4 view facing right",
    width: 1400,
    height: 900,
    aspectRatio: 1400 / 900,
    orientation: "right",
    concealment: "scene-boundary",
  },
  "rear-3q-left": {
    id: "rear-3q-left",
    name: "06_rear_three_quarter_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-van-rear-three-quarter-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-rear-three-quarter-facing-left.png",
    alt: "KT Couriers van rear 3/4 view facing left",
    width: 1400,
    height: 900,
    aspectRatio: 1400 / 900,
    orientation: "left",
    concealment: "scene-boundary",
  },
  "centered-hero": {
    id: "centered-hero",
    name: "07_centered_hero_version",
    webpSrc: "/media/public/protagonists/protagonist-van-centered-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-centered-hero.png",
    alt: "KT Couriers van centered hero profile",
    width: 1400,
    height: 800,
    aspectRatio: 1400 / 800,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "front-half-close": {
    id: "front-half-close",
    name: "08_close_crop_front_half",
    webpSrc: "/media/public/protagonists/protagonist-van-close-crop-front-half.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-close-crop-front-half.png",
    alt: "KT Couriers van front half crop",
    width: 1100,
    height: 800,
    aspectRatio: 1.375,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "rear-half-close": {
    id: "rear-half-close",
    name: "09_close_crop_rear_half",
    webpSrc: "/media/public/protagonists/protagonist-van-close-crop-rear-half.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-close-crop-rear-half.png",
    alt: "KT Couriers van rear cargo area crop",
    width: 1100,
    height: 800,
    aspectRatio: 1.375,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "sliding-door-open": {
    id: "sliding-door-open",
    name: "10_side_sliding_door_open",
    webpSrc: "/media/public/protagonists/protagonist-van-sliding-door-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-sliding-door-open.png",
    alt: "KT Couriers van with side sliding door open ready for parcel",
    width: 1400,
    height: 800,
    aspectRatio: 1400 / 800,
    orientation: "right",
    concealment: "door-sequence",
  },
  "rear-doors-open": {
    id: "rear-doors-open",
    name: "11_rear_doors_open",
    webpSrc: "/media/public/protagonists/protagonist-van-rear-doors-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-rear-doors-open.png",
    alt: "KT Couriers van rear doors open",
    width: 1400,
    height: 900,
    aspectRatio: 1400 / 900,
    orientation: "center",
    concealment: "door-sequence",
  },
  "all-doors-open": {
    id: "all-doors-open",
    name: "12_side_and_rear_doors_open",
    webpSrc: "/media/public/protagonists/protagonist-van-all-doors-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-all-doors-open.png",
    alt: "KT Couriers van side and rear doors open for major loading",
    width: 1400,
    height: 900,
    aspectRatio: 1400 / 900,
    orientation: "center",
    concealment: "door-sequence",
  },
  "motion-transition": {
    id: "motion-transition",
    name: "13_slight_motion_web_transition",
    webpSrc: "/media/public/protagonists/protagonist-van-slight-motion-web-transition.webp",
    pngSrc: "/media/public/protagonists/protagonist-van-slight-motion-web-transition.png",
    alt: "KT Couriers van arriving in slight motion",
    width: 1400,
    height: 800,
    aspectRatio: 1400 / 800,
    orientation: "right",
    concealment: "scene-boundary",
  },
};

// ---------------------------------------------------------------------------
// Red Freight Truck — 12 States (High-Intensity Network Heavy Haul)
// ---------------------------------------------------------------------------
export type RedTruckStateId =
  | "side-right" // 01
  | "side-left" // 02
  | "front-3q-right" // 03
  | "front-3q-left" // 04
  | "rear-3q-right" // 05
  | "rear-3q-left" // 06
  | "centered-hero" // 07
  | "cab-crop" // 08
  | "trailer-middle-crop" // 09
  | "rear-trailer-crop" // 10
  | "motion-entry" // 11
  | "curtain-open"; // 12

export const RED_TRUCK_STATES: Record<RedTruckStateId, ActorStateDefinition> = {
  "side-right": {
    id: "side-right",
    name: "01_full_side_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-side-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-side-right.png",
    alt: "KT Couriers heavy haul red truck side view right",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "right",
    concealment: "road-geometry",
  },
  "side-left": {
    id: "side-left",
    name: "02_full_side_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-full-side-view-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-full-side-view-facing-left.png",
    alt: "KT Couriers heavy freight red truck side view left",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "left",
    concealment: "road-geometry",
  },
  "front-3q-right": {
    id: "front-3q-right",
    name: "03_front_three_quarter_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-right.png",
    alt: "KT Couriers heavy red truck front 3/4 view right",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "right",
    concealment: "road-geometry",
  },
  "front-3q-left": {
    id: "front-3q-left",
    name: "04_front_three_quarter_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-front-three-quarter-view-facing-left.png",
    alt: "KT Couriers heavy red truck front 3/4 view left",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "left",
    concealment: "road-geometry",
  },
  "rear-3q-right": {
    id: "rear-3q-right",
    name: "05_rear_three_quarter_view_facing_right",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-rear-three-quarter-view-facing-right.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-rear-three-quarter-view-facing-right.png",
    alt: "KT Couriers heavy red truck rear 3/4 view right",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "right",
    concealment: "road-geometry",
  },
  "rear-3q-left": {
    id: "rear-3q-left",
    name: "06_rear_three_quarter_view_facing_left",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-rear-three-quarter-view-facing-left.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-rear-three-quarter-view-facing-left.png",
    alt: "KT Couriers heavy red truck rear 3/4 view left",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "left",
    concealment: "road-geometry",
  },
  "centered-hero": {
    id: "centered-hero",
    name: "07_centered_hero_version",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-centered-hero.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-centered-hero.png",
    alt: "KT Couriers red freight truck centered climax hero",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "center",
    concealment: "scene-boundary",
  },
  "cab-crop": {
    id: "cab-crop",
    name: "08_front_cab_close_crop",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-front-cab-close-crop.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-front-cab-close-crop.png",
    alt: "KT Couriers heavy red truck cab detail",
    width: 1200,
    height: 800,
    aspectRatio: 1.5,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "trailer-middle-crop": {
    id: "trailer-middle-crop",
    name: "09_trailer_middle_section_close_crop",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-trailer-middle-section-close-crop.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-trailer-middle-section-close-crop.png",
    alt: "KT Couriers red freight trailer middle section",
    width: 1300,
    height: 800,
    aspectRatio: 1.625,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "rear-trailer-crop": {
    id: "rear-trailer-crop",
    name: "10_rear_trailer_section_close_crop",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-rear-trailer-section-close-crop.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-rear-trailer-section-close-crop.png",
    alt: "KT Couriers red freight rear trailer detail",
    width: 1300,
    height: 800,
    aspectRatio: 1.625,
    orientation: "detail",
    concealment: "camera-crop",
  },
  "motion-entry": {
    id: "motion-entry",
    name: "11_motion_version",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-motion-version.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-motion-version.png",
    alt: "KT Couriers red freight truck arriving on highway with motion energy",
    width: 1672,
    height: 941,
    aspectRatio: 1672 / 941,
    orientation: "right",
    concealment: "road-geometry",
  },
  "curtain-open": {
    id: "curtain-open",
    name: "12_trailer_curtain_partially_opened",
    webpSrc: "/media/public/protagonists/protagonist-truck-red-curtain-open.webp",
    pngSrc: "/media/public/protagonists/protagonist-truck-red-curtain-open.png",
    alt: "KT Couriers red freight trailer curtain partially open",
    width: 1448,
    height: 1086,
    aspectRatio: 1448 / 1086,
    orientation: "detail",
    concealment: "door-sequence",
  },
};
