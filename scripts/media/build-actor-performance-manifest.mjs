import { readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const imagesDir = path.join(rootDir, "public", "media", "public", "images");
const protagonistsWebpDir = path.join(rootDir, "public", "media", "public", "protagonists");
const artifactsMediaDir = path.join(rootDir, "artifacts", "media");
const generatedDir = path.join(rootDir, "components", "public-v3", "actors");

// Homepage last-mile roles are selected from the reviewed transparent human
// candidates. They stay in the same fail-closed registry as the vehicle packs.
const HOMEPAGE_HUMAN_REGISTRY = [
  ["courier", "delivery-hold", "courier_just_after_delivery.png", "center", "idle", "last-mile", "courier-delivery-hold"],
  ["courier", "walk-left-01", "isolated_courier_walking_with_package.png", "left", "travel", "last-mile", "courier-walk-left-01"],
  ["courier", "walk-left-02", "side_view_courier_carrying_box.png", "left", "travel", "last-mile", "courier-walk-left-02"],
  ["courier", "approach-hold", "courier_delivering_a_cardboard_parcel.png", "left", "approach", "last-mile", "courier-approach-hold"],
  ["courier", "present", "profile_courier_offering_a_package.png", "left", "handoff", "last-mile", "courier-present"],
  ["courier", "offer", "courier_handing_over_a_cardboard_box.png", "left", "handoff", "last-mile", "courier-offer"],
  ["courier", "release-pre", "courier_releasing_cardboard_package.png", "left", "handoff", "last-mile", "courier-release-pre"],
  ["courier", "release-post", "courier_just_after_delivery.png", "right", "handoff", "last-mile", "courier-release-post-single"],
  ["courier", "turn-back", "turning_courier_in_red_cap_and_polo.png", "right", "turn", "last-mile", "courier-turn-back"],
  ["courier", "return-right-01", "04_walking_one_parcel_facing_right.png", "right", "travel", "last-mile", "courier-return-right-01"],
  ["courier", "return-right-02", "red_capped_courier_walking_right.png", "right", "depart", "last-mile", "courier-return-right-02"],
  ["recipient", "neutral", "young_man_in_beige_shirt_and_sneakers.png", "right", "idle", "arrival-customer", "recipient-neutral"],
  ["recipient", "ready", "man_ready_to_receive_a_package.png", "right", "idle", "arrival-customer", "recipient-ready"],
  ["recipient", "reach", "reaching_recipient_in_beige_shirt.png", "right", "handoff", "arrival-customer", "recipient-reach"],
  ["recipient", "receive-contact", "man_receiving_cardboard_package.png", "right", "handoff", "arrival-customer", "recipient-receive-contact"],
  ["recipient", "hold-parcel", "young_man_holding_cardboard_parcel.png", "right", "carry", "arrival-customer", "recipient-hold-parcel"],
  ["recipient", "after-receive", "young_man_holding_cardboard_package.png", "right", "carry", "arrival-customer", "recipient-after-receive"],
  ["recipient", "hold-relaxed", "full_body_portrait_of_a_young_man.png", "right", "idle", "arrival-customer", "recipient-hold-relaxed"],
  ["handoff", "approach-gap", "delivery_handoff_in_progress.png", "center", "handoff", "custody-transfer", "handoff-approach-gap"],
  ["handoff", "handoff-start", "delivery_handoff_moment.png", "center", "handoff", "custody-transfer", "handoff-start"],
  ["handoff", "shared-contact", "parcel_handoff_with_friendly_delivery_duo.png", "center", "handoff", "custody-transfer", "handoff-shared-contact"],
  ["handoff", "transfer-complete", "package_handoff_complete.png", "center", "handoff", "custody-transfer", "handoff-transfer-complete"],
  ["handoff", "post-handoff", "completed_delivery_handoff.png", "center", "handoff", "custody-transfer", "handoff-post-handoff"],
  ["handoff", "separation", "delivery_handoff_complete.png", "center", "handoff", "custody-transfer", "handoff-separation"],
].map(([actorType, id, sourceFile, direction, action, family, webpStem]) => ({
  packName: "KT_Courier_20_Transparent_PNG_Assets", actorType, id, sourceFile, direction, action, family,
  webpFilename: `protagonist-${webpStem}.webp`, convertToWebp: true,
  validPreviousStates: [], validNextStates: [], requiredOcclusion: actorType === "handoff" ? "custody-seam" : "architectural-mask",
}));

for (const actorType of ["courier", "recipient", "handoff"]) {
  const familyStates = HOMEPAGE_HUMAN_REGISTRY.filter((entry) => entry.actorType === actorType);
  familyStates.forEach((entry, index) => {
    entry.validPreviousStates = index > 0 ? [familyStates[index - 1].id] : [];
    entry.validNextStates = index < familyStates.length - 1 ? [familyStates[index + 1].id] : [];
  });
}

// Canonical definition table for all 74 master assets
const CANONICAL_REGISTRY = [
  // ---------------------------------------------------------------------------
  // White Truck (28 States)
  // ---------------------------------------------------------------------------
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "01_full_side_view_facing_right.png",
    id: "side-right",
    direction: "right",
    action: "travel",
    family: "hero",
    webpFilename: "protagonist-truck-white-side-right.webp",
    humanGroundContact: { x: 0.1420, y: 0.8002 },
    validPreviousStates: ["front-3q-right", "wide-hero", "centered-hero"],
    validNextStates: ["wide-hero", "cargo-box-close"],
    requiredOcclusion: "typography-occlusion",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "02_full_side_view_facing_left.png",
    id: "side-left",
    direction: "left",
    action: "travel",
    family: "network",
    webpFilename: "protagonist-truck-white-side-left.webp",
    humanGroundContact: { x: 0.8565, y: 0.7938 },
    validPreviousStates: ["front-3q-left"],
    validNextStates: ["rear-3q-left"],
    requiredOcclusion: "typography-occlusion",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "03_centered_hero_side_view.png",
    id: "centered-hero",
    direction: "right",
    action: "idle",
    family: "hero",
    webpFilename: "protagonist-truck-white-centered-hero.webp",
    humanGroundContact: { x: 0.8565, y: 0.7938 },
    validPreviousStates: ["side-right"],
    validNextStates: ["side-right"],
    requiredOcclusion: "typography-occlusion",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "04_front_three_quarter_view_facing_right.png",
    id: "front-3q-right",
    direction: "right",
    action: "approach",
    family: "road",
    webpFilename: "protagonist-truck-white-front-3q-right.webp",
    validPreviousStates: [],
    validNextStates: ["side-right"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "05_front_three_quarter_view_facing_left.png",
    id: "front-3q-left",
    direction: "left",
    action: "approach",
    family: "road",
    webpFilename: "protagonist-truck-white-front-3q-left.webp",
    validPreviousStates: [],
    validNextStates: ["side-left"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "06_rear_three_quarter_view_facing_right.png",
    id: "rear-3q-right",
    direction: "right",
    action: "depart",
    family: "road",
    webpFilename: "protagonist-truck-white-rear-three-quarter-view-facing-right.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "07_rear_three_quarter_view_facing_left.png",
    id: "rear-3q-left",
    direction: "left",
    action: "depart",
    family: "road",
    webpFilename: "protagonist-truck-white-rear-three-quarter-view-facing-left.webp",
    validPreviousStates: ["side-left"],
    validNextStates: [],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "08_top_down_view.png",
    id: "top-down-straight",
    direction: "top-down",
    action: "travel",
    family: "route",
    webpFilename: "protagonist-truck-white-top-down-straight.webp",
    humanGroundContact: { x: 0.5000, y: 0.5000 },
    validPreviousStates: [],
    validNextStates: ["top-down-angled"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "09_top_down_angled_straight_road.png",
    id: "top-down-angled",
    direction: "top-down",
    action: "approach",
    family: "route",
    webpFilename: "protagonist-truck-white-top-down-angled-straight-road.webp",
    humanGroundContact: { x: 0.5000, y: 0.5000 },
    validPreviousStates: ["top-down-straight"],
    validNextStates: ["top-down-turning"],
    requiredOcclusion: "overpass-shadow",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "10_oversized_wide_hero_composition.png",
    id: "wide-hero",
    direction: "right",
    action: "travel",
    family: "hero",
    webpFilename: "protagonist-truck-white-oversized-wide-hero-composition.webp",
    humanGroundContact: { x: 0.8502, y: 0.8575 },
    validPreviousStates: ["side-right"],
    validNextStates: ["cargo-box-close", "side-right"],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "11_close_crop_front_cab_only.png",
    id: "front-cab-close",
    direction: "right",
    action: "travel",
    family: "detail",
    webpFilename: "protagonist-truck-white-close-crop-front-cab-only.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "12_close_crop_long_cargo_box_only.png",
    id: "cargo-box-close",
    direction: "right",
    action: "travel",
    family: "detail",
    webpFilename: "protagonist-truck-white-cargo-box-material.webp",
    validPreviousStates: ["wide-hero"],
    validNextStates: [],
    requiredOcclusion: "trailer-takeover",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "13_close_crop_rear_portion_only.png",
    id: "rear-portion-close",
    direction: "right",
    action: "travel",
    family: "detail",
    webpFilename: "protagonist-truck-white-close-crop-rear-portion-only.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "14_rear_doors_slightly_open.png",
    id: "rear-doors-open",
    direction: "rear",
    action: "open",
    family: "detail",
    webpFilename: "protagonist-truck-white-rear-doors-slightly-open.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "15_subtle_motion_energy.png",
    id: "motion-energy",
    direction: "left", // Visually audited: truck faces left in this master
    action: "accelerate",
    family: "network-motion-left", // Excluded from rightward Hero family
    webpFilename: "protagonist-truck-white-subtle-motion-energy.webp",
    humanGroundContact: { x: 0.1584, y: 0.8283 },
    validPreviousStates: ["side-left"],
    validNextStates: ["side-left"],
    requiredOcclusion: "typography-occlusion",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "16_top_down_turning_curve_transition.png",
    id: "top-down-turning",
    direction: "turning",
    action: "turn",
    family: "route",
    webpFilename: "protagonist-truck-white-top-down-turning.webp",
    humanGroundContact: { x: 0.5000, y: 0.5000 },
    validPreviousStates: ["top-down-angled"],
    validNextStates: [],
    requiredOcclusion: "overpass-shadow",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "17_front_3q_entry_phase_01.png",
    id: "front-3q-entry-phase-01",
    direction: "right",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-3q-entry-phase-01.webp",
    validPreviousStates: [],
    validNextStates: ["front-3q-entry-phase-02"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "18_front_3q_entry_phase_02.png",
    id: "front-3q-entry-phase-02",
    direction: "right",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-3q-entry-phase-02.webp",
    validPreviousStates: ["front-3q-entry-phase-01"],
    validNextStates: ["front-3q-entry-phase-03"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "19_front_3q_entry_phase_03.png",
    id: "front-3q-entry-phase-03",
    direction: "right",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-3q-entry-phase-03.webp",
    validPreviousStates: ["front-3q-entry-phase-02"],
    validNextStates: ["front-3q-entry-phase-04"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "20_front_3q_entry_phase_04.png",
    id: "front-3q-entry-phase-04",
    direction: "right",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-3q-entry-phase-04.webp",
    validPreviousStates: ["front-3q-entry-phase-03"],
    validNextStates: ["front-3q-entry-phase-05"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "21_front_3q_entry_phase_05.png",
    id: "front-3q-entry-phase-05",
    direction: "right",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-3q-entry-phase-05.webp",
    validPreviousStates: ["front-3q-entry-phase-04"],
    validNextStates: ["front-3q-entry-phase-06"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "22_front_3q_entry_phase_06.png",
    id: "front-3q-entry-phase-06",
    direction: "right",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-3q-entry-phase-06.webp",
    validPreviousStates: ["front-3q-entry-phase-05"],
    validNextStates: ["front-center-transition-phase-01"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "23_front_center_transition_phase_01.png",
    id: "front-center-transition-phase-01",
    direction: "front",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-center-transition-phase-01.webp",
    validPreviousStates: ["front-3q-entry-phase-06"],
    validNextStates: ["front-center-transition-phase-02"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "24_front_center_transition_phase_02.png",
    id: "front-center-transition-phase-02",
    direction: "front",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-front-center-transition-phase-02.webp",
    validPreviousStates: ["front-center-transition-phase-01"],
    validNextStates: ["true-front-center-full"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "25_true_front_center_full.png",
    id: "true-front-center-full",
    direction: "front",
    action: "idle",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-true-front-center-full.webp",
    validPreviousStates: ["front-center-transition-phase-02"],
    validNextStates: ["true-front-center-medium"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "26_true_front_center_medium.png",
    id: "true-front-center-medium",
    direction: "front",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-true-front-center-medium.webp",
    validPreviousStates: ["true-front-center-full"],
    validNextStates: ["true-front-center-close"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "27_true_front_center_close.png",
    id: "true-front-center-close",
    direction: "front",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-true-front-center-close.webp",
    validPreviousStates: ["true-front-center-medium"],
    validNextStates: ["true-front-center-extreme-close"],
    requiredOcclusion: "none",
  },
  {
    packName: "white_truck_asset_pack_16_images",
    actorType: "white-truck",
    sourceFile: "28_true_front_center_extreme_close.png",
    id: "true-front-center-extreme-close",
    direction: "front",
    action: "approach",
    family: "hero-sequence",
    webpFilename: "protagonist-truck-white-true-front-center-extreme-close.webp",
    validPreviousStates: ["true-front-center-close"],
    validNextStates: [],
    requiredOcclusion: "none",
  },

  // ---------------------------------------------------------------------------
  // Van (14 source states + 2 existing mirrored collection derivatives)
  // ---------------------------------------------------------------------------
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "01_full_side_view_facing_right.png",
    id: "side-right",
    direction: "right",
    action: "travel",
    family: "street-right",
    webpFilename: "protagonist-van-side-right.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "02_full_side_view_facing_left.png",
    id: "side-left",
    direction: "left",
    action: "travel",
    family: "collection",
    webpFilename: "protagonist-van-full-side-view-facing-left.webp",
    humanGroundContact: { x: 0.7997, y: 0.8177 },
    validPreviousStates: ["motion-transition"],
    validNextStates: ["sliding-door-open"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "02_full_side_view_facing_left.png (mirrored deterministic derivative)",
    sourcePath: "02_full_side_view_facing_left.png",
    metadataFromRuntime: true,
    id: "collection-side-right",
    direction: "right",
    action: "travel",
    family: "collection-right",
    webpFilename: "protagonist-van-collection-side-right.webp",
    humanGroundContact: { x: 0.2003, y: 0.8177 },
    validPreviousStates: [],
    validNextStates: ["collection-door-open-right"],
    requiredOcclusion: "none",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "10_side_sliding_door_open.png (mirrored deterministic derivative)",
    sourcePath: "10_side_sliding_door_open.png",
    metadataFromRuntime: true,
    id: "collection-door-open-right",
    direction: "right",
    action: "open",
    family: "collection-right",
    webpFilename: "protagonist-van-collection-door-open-right.webp",
    humanGroundContact: { x: 0.1982, y: 0.825 },
    validPreviousStates: ["collection-side-right"],
    validNextStates: ["collection-side-right"],
    requiredOcclusion: "none",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "03_front_three_quarter_facing_right.png",
    id: "front-3q-right",
    direction: "right",
    action: "approach",
    family: "street-right",
    webpFilename: "protagonist-van-front-three-quarter-facing-right.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "04_front_three_quarter_facing_left.png",
    id: "front-3q-left",
    direction: "left",
    action: "approach",
    family: "collection",
    webpFilename: "protagonist-van-front-three-quarter-facing-left.webp",
    validPreviousStates: [],
    validNextStates: ["side-left"],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "05_rear_three_quarter_facing_right.png",
    id: "rear-3q-right",
    direction: "right",
    action: "depart",
    family: "street-right",
    webpFilename: "protagonist-van-rear-three-quarter-facing-right.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "06_rear_three_quarter_facing_left.png",
    id: "rear-3q-left",
    direction: "left",
    action: "depart",
    family: "street-left",
    webpFilename: "protagonist-van-rear-three-quarter-facing-left.webp",
    validPreviousStates: ["side-left"],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "07_centered_hero_version.png",
    id: "centered-hero",
    direction: "left",
    action: "idle",
    family: "street-left",
    webpFilename: "protagonist-van-centered-hero.webp",
    validPreviousStates: ["side-left"],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "08_close_crop_front_half.png",
    id: "front-half-close",
    direction: "detail",
    action: "idle",
    family: "detail",
    webpFilename: "protagonist-van-close-crop-front-half.webp",
    validPreviousStates: ["side-left"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "09_close_crop_rear_half.png",
    id: "rear-half-close",
    direction: "detail",
    action: "idle",
    family: "detail",
    webpFilename: "protagonist-van-close-crop-rear-half.webp",
    validPreviousStates: ["side-left"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "10_side_sliding_door_open.png",
    id: "sliding-door-open",
    direction: "left",
    action: "open",
    family: "collection",
    webpFilename: "protagonist-van-sliding-door-open.webp",
    humanGroundContact: { x: 0.8018, y: 0.8250 },
    validPreviousStates: ["side-left"],
    validNextStates: ["side-left"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "11_rear_doors_open.png",
    id: "rear-doors-open",
    direction: "rear",
    action: "open",
    family: "loading",
    webpFilename: "protagonist-van-rear-doors-open.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "12_side_and_rear_doors_open.png",
    id: "all-doors-open",
    direction: "rear",
    action: "open",
    family: "loading",
    webpFilename: "protagonist-van-all-doors-open.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "13_slight_motion_web_transition.png",
    id: "motion-transition",
    direction: "left",
    action: "approach",
    family: "collection",
    webpFilename: "protagonist-van-slight-motion-web-transition.webp",
    humanGroundContact: { x: 0.4685, y: 0.8916 },
    validPreviousStates: [],
    validNextStates: ["side-left"],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "14_service_card_category_version.png",
    id: "service-card",
    direction: "right",
    action: "idle",
    family: "service",
    webpFilename: "protagonist-van-service-card-category-version.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },

  // ---------------------------------------------------------------------------
  // Van — 16 States (Last-mile delivery sequence)
  // ---------------------------------------------------------------------------
  // These masters are a separate pack from the original Van collection. Keep
  // their canonical IDs namespaced by the delivery narrative so the old Hero
  // and collection states remain stable.
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_01.png",
    id: "delivery-entry-01",
    direction: "left",
    action: "approach",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-entry-01.webp",
    convertToWebp: true,
    validPreviousStates: [],
    validNextStates: ["delivery-entry-02"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_02.png",
    id: "delivery-entry-02",
    direction: "left",
    action: "approach",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-entry-02.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-entry-01"],
    validNextStates: ["delivery-entry-03"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_03.png",
    id: "delivery-entry-03",
    direction: "left",
    action: "approach",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-entry-03.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-entry-02"],
    validNextStates: ["delivery-entry-04"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_04.png",
    id: "delivery-entry-04",
    direction: "left",
    action: "approach",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-entry-04.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-entry-03"],
    validNextStates: ["delivery-center-approach"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_05.png",
    id: "delivery-center-approach",
    direction: "left",
    action: "approach",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-center-approach.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-entry-04"],
    validNextStates: ["delivery-center-settle"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_06.png",
    id: "delivery-center-settle",
    direction: "left",
    action: "idle",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-center-settle.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-center-approach"],
    validNextStates: ["delivery-side-hold"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_07.png",
    id: "delivery-side-hold",
    direction: "left",
    action: "idle",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-side-hold.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-center-settle"],
    validNextStates: ["delivery-door-open-15"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_08.png",
    id: "delivery-door-open-15",
    direction: "left",
    action: "open",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-open-15.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-side-hold"],
    validNextStates: ["delivery-door-open-35"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_09.png",
    id: "delivery-door-open-35",
    direction: "left",
    action: "open",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-open-35.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-open-15"],
    validNextStates: ["delivery-door-open-60"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_10.png",
    id: "delivery-door-open-60",
    direction: "left",
    action: "open",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-open-60.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-open-35"],
    validNextStates: ["delivery-door-open-85"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_11.png",
    id: "delivery-door-open-85",
    direction: "left",
    action: "open",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-open-85.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-open-60"],
    validNextStates: ["delivery-door-open-full"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_12.png",
    id: "delivery-door-open-full",
    direction: "left",
    action: "open",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-open-full.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-open-85"],
    validNextStates: ["delivery-door-close-60"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_13.png",
    id: "delivery-door-close-60",
    direction: "left",
    action: "close",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-close-60.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-open-full"],
    validNextStates: ["delivery-door-close-20"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_14.png",
    id: "delivery-door-close-20",
    direction: "left",
    action: "close",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-door-close-20.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-close-60"],
    validNextStates: ["delivery-departure-start"],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_15.png",
    id: "delivery-departure-start",
    direction: "left",
    action: "depart",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-departure-start.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-door-close-20"],
    validNextStates: ["delivery-departure-exit"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "KT_Courier_Van_Asset_Pack_14_PNGs",
    actorType: "van",
    sourceFile: "KT_Courier_Van_16.png",
    id: "delivery-departure-exit",
    direction: "left",
    action: "depart",
    family: "last-mile-delivery",
    webpFilename: "protagonist-van-delivery-departure-exit.webp",
    convertToWebp: true,
    validPreviousStates: ["delivery-departure-start"],
    validNextStates: [],
    requiredOcclusion: "viewport-edge",
  },

  // ---------------------------------------------------------------------------
  // Courier (20 States)
  // ---------------------------------------------------------------------------
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "01_original_pose_refined.png",
    id: "hero-standing",
    direction: "front",
    action: "idle",
    family: "portrait",
    webpFilename: "protagonist-courier-hero-standing.webp",
    humanGroundContact: { x: 0.7028, y: 0.9993 },
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "02_full_body_one_parcel.png",
    id: "full-body-one-parcel",
    direction: "front",
    action: "carry",
    family: "portrait",
    webpFilename: "protagonist-courier-carry-one-parcel.webp",
    humanGroundContact: { x: 0.5936, y: 0.9715 },
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "03_full_body_two_parcels.png",
    id: "full-body-two-parcels",
    direction: "front",
    action: "carry",
    family: "portrait",
    webpFilename: "protagonist-courier-full-body-two-parcels.webp",
    humanGroundContact: { x: 0.5896, y: 0.9722 },
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "04_walking_one_parcel_facing_right.png",
    id: "walk-right-one-parcel",
    direction: "right",
    action: "travel",
    family: "street",
    webpFilename: "protagonist-courier-walk-right-one-parcel.webp",
    humanGroundContact: { x: 0.6756, y: 0.9536 },
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "05_walking_one_parcel_facing_left.png",
    id: "walk-left-one-parcel",
    direction: "left",
    action: "travel",
    family: "arrival",
    webpFilename: "protagonist-courier-walking-one-parcel-facing-left.webp",
    humanGroundContact: { x: 0.3721, y: 0.9565 },
    validPreviousStates: [],
    validNextStates: ["extending-handoff"],
    requiredOcclusion: "architectural-mask",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "06_walking_two_parcels.png",
    id: "walk-two-parcels",
    direction: "right",
    action: "travel",
    family: "street",
    webpFilename: "protagonist-courier-walking-two-parcels.webp",
    humanGroundContact: { x: 0.3619, y: 0.9608 },
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "07_ready_to_handover_parcel.png",
    id: "ready-handover",
    direction: "left",
    action: "handoff",
    family: "custody",
    webpFilename: "protagonist-courier-ready-handover.webp",
    humanGroundContact: { x: 0.6373, y: 0.9829 },
    validPreviousStates: ["loading-unloading"],
    validNextStates: ["extending-handoff"],
    requiredOcclusion: "custody-seam",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "08_extending_parcel_for_handoff.png",
    id: "extending-handoff",
    direction: "left",
    action: "handoff",
    family: "arrival",
    webpFilename: "protagonist-courier-extending-handoff.webp",
    humanGroundContact: { x: 0.5936, y: 0.9736 },
    validPreviousStates: ["walk-left-one-parcel", "ready-handover"],
    validNextStates: [],
    requiredOcclusion: "parcel-coverage",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "09_looking_toward_viewer_with_parcel.png",
    id: "look-viewer-parcel",
    direction: "front",
    action: "idle",
    family: "portrait",
    webpFilename: "protagonist-courier-looking-toward-viewer-with-parcel.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "10_looking_right_approaching_vehicle.png",
    id: "look-right-approach",
    direction: "right",
    action: "approach",
    family: "vehicle",
    webpFilename: "protagonist-courier-approach-vehicle.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "door-sequence",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "11_looking_left_approaching_vehicle.png",
    id: "look-left-approach",
    direction: "left",
    action: "approach",
    family: "collection",
    webpFilename: "protagonist-courier-looking-left-approaching-vehicle.webp",
    humanGroundContact: { x: 0.6898, y: 0.9779 },
    validPreviousStates: [],
    validNextStates: ["lift-parcel"],
    requiredOcclusion: "van-door",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "12_placing_parcel_down.png",
    id: "place-parcel",
    direction: "front",
    action: "load",
    family: "loading",
    webpFilename: "protagonist-courier-placing-parcel-down.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "13_lifting_parcel_up.png",
    id: "lift-parcel",
    direction: "left",
    action: "load",
    family: "collection",
    webpFilename: "protagonist-courier-lifting-parcel-up.webp",
    humanGroundContact: { x: 0.6800, y: 0.9779 },
    validPreviousStates: ["look-left-approach"],
    validNextStates: ["loading-unloading"],
    requiredOcclusion: "parcel-coverage",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "14_small_parcel_one_hand.png",
    id: "small-parcel-one-hand",
    direction: "front",
    action: "carry",
    family: "portrait",
    webpFilename: "protagonist-courier-small-parcel-one-hand.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "15_medium_box_under_arm.png",
    id: "medium-box-arm",
    direction: "front",
    action: "carry",
    family: "portrait",
    webpFilename: "protagonist-courier-medium-box-under-arm.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "16_empty_hands_courier_hero.png",
    id: "empty-hands-hero",
    direction: "front",
    action: "idle",
    family: "portrait",
    webpFilename: "protagonist-courier-empty-hands-courier-hero.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "17_forward_gesture_with_parcel.png",
    id: "forward-gesture",
    direction: "front",
    action: "handoff",
    family: "arrival",
    webpFilename: "protagonist-courier-forward-gesture-with-parcel.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "18_loading_unloading_parcel.png",
    id: "loading-unloading",
    direction: "left",
    action: "load",
    family: "collection",
    webpFilename: "protagonist-courier-loading-unloading.webp",
    humanGroundContact: { x: 0.7594, y: 0.9757 },
    validPreviousStates: ["lift-parcel"],
    validNextStates: ["ready-handover"],
    requiredOcclusion: "parcel-coverage",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "19_half_body_holding_parcel.png",
    id: "half-body-holding",
    direction: "front",
    action: "carry",
    family: "portrait",
    webpFilename: "protagonist-courier-half-body-holding-parcel.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "KT_Courier_20_Transparent_PNG_Assets",
    actorType: "courier",
    sourceFile: "20_close_crop_upper_body_portrait.png",
    id: "portrait-upper-body",
    direction: "detail",
    action: "idle",
    family: "detail",
    webpFilename: "protagonist-courier-close-crop-upper-body-portrait.webp",
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },

  // ---------------------------------------------------------------------------
  // Red Truck (12 States)
  // ---------------------------------------------------------------------------
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "01_full_side_view_facing_right.png",
    id: "side-right",
    direction: "right",
    action: "travel",
    family: "freight",
    webpFilename: "protagonist-truck-red-side-right.webp",
    humanGroundContact: { x: 0.9103, y: 0.7566 },
    validPreviousStates: ["motion-entry"],
    validNextStates: ["curtain-open", "centered-hero"],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "02_full_side_view_facing_left.png",
    id: "side-left",
    direction: "left",
    action: "travel",
    family: "freight-left",
    webpFilename: "protagonist-truck-red-full-side-view-facing-left.webp",
    humanGroundContact: { x: 0.0906, y: 0.7354 },
    validPreviousStates: [],
    validNextStates: [],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "03_front_three_quarter_view_facing_right.png",
    id: "front-3q-right",
    direction: "right",
    action: "approach",
    family: "road",
    webpFilename: "protagonist-truck-red-front-three-quarter-view-facing-right.webp",
    validPreviousStates: [],
    validNextStates: ["side-right"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "04_front_three_quarter_view_facing_left.png",
    id: "front-3q-left",
    direction: "left",
    action: "approach",
    family: "road",
    webpFilename: "protagonist-truck-red-front-three-quarter-view-facing-left.webp",
    validPreviousStates: [],
    validNextStates: ["side-left"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "05_rear_three_quarter_view_facing_right.png",
    id: "rear-3q-right",
    direction: "right",
    action: "depart",
    family: "road",
    webpFilename: "protagonist-truck-red-rear-three-quarter-view-facing-right.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "06_rear_three_quarter_view_facing_left.png",
    id: "rear-3q-left",
    direction: "left",
    action: "depart",
    family: "road",
    webpFilename: "protagonist-truck-red-rear-three-quarter-view-facing-left.webp",
    validPreviousStates: ["side-left"],
    validNextStates: [],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "07_centered_hero_version.png",
    id: "centered-hero",
    direction: "center",
    action: "idle",
    family: "freight",
    webpFilename: "protagonist-truck-red-centered-hero.webp",
    humanGroundContact: { x: 0.4462, y: 0.7492 },
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "scene-boundary",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "08_front_cab_close_crop.png",
    id: "cab-crop",
    direction: "detail",
    action: "travel",
    family: "detail",
    webpFilename: "protagonist-truck-red-front-cab-close-crop.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "09_trailer_middle_section_close_crop.png",
    id: "trailer-middle-crop",
    direction: "detail",
    action: "travel",
    family: "detail",
    webpFilename: "protagonist-truck-red-trailer-middle-section-close-crop.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "10_rear_trailer_section_close_crop.png",
    id: "rear-trailer-crop",
    direction: "detail",
    action: "travel",
    family: "detail",
    webpFilename: "protagonist-truck-red-rear-trailer-section-close-crop.webp",
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "11_motion_version.png",
    id: "motion-entry",
    direction: "right",
    action: "accelerate",
    family: "freight",
    webpFilename: "protagonist-truck-red-motion-version.webp",
    humanGroundContact: { x: 0.1041, y: 0.7556 },
    validPreviousStates: [],
    validNextStates: ["side-right"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "12_trailer_curtain_partially_opened.png",
    id: "curtain-open",
    direction: "right",
    action: "open",
    family: "freight",
    webpFilename: "protagonist-truck-red-curtain-open.webp",
    humanGroundContact: { x: 0.2692, y: 0.7577 },
    validPreviousStates: ["side-right"],
    validNextStates: [],
    requiredOcclusion: "door-sequence",
  },

  // ---------------------------------------------------------------------------
  // Red Truck — 12 States (Freight wipe / trailer takeover sequence)
  // ---------------------------------------------------------------------------
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R01_entry_phase_01.png",
    id: "wipe-entry-01",
    direction: "left",
    action: "approach",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-entry-01.webp",
    convertToWebp: true,
    validPreviousStates: [],
    validNextStates: ["wipe-entry-02"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R02_entry_phase_02.png",
    id: "wipe-entry-02",
    direction: "left",
    action: "approach",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-entry-02.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-entry-01"],
    validNextStates: ["wipe-entry-03"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R03_entry_phase_03.png",
    id: "wipe-entry-03",
    direction: "left",
    action: "approach",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-entry-03.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-entry-02"],
    validNextStates: ["wipe-side-full"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R04_transition_side_full.png",
    id: "wipe-side-full",
    direction: "left",
    action: "travel",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-side-full.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-entry-03"],
    validNextStates: ["wipe-giant-full"],
    requiredOcclusion: "road-geometry",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R05_giant_crossing_full.png",
    id: "wipe-giant-full",
    direction: "left",
    action: "travel",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-giant-full.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-side-full"],
    validNextStates: ["wipe-giant-front"],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R06_giant_crossing_crop_front.png",
    id: "wipe-giant-front",
    direction: "left",
    action: "travel",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-giant-front.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-giant-full"],
    validNextStates: ["wipe-giant-mid"],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R07_giant_crossing_crop_mid.png",
    id: "wipe-giant-mid",
    direction: "left",
    action: "travel",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-giant-mid.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-giant-front"],
    validNextStates: ["wipe-giant-rear"],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R08_giant_crossing_crop_rear.png",
    id: "wipe-giant-rear",
    direction: "left",
    action: "travel",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-giant-rear.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-giant-mid"],
    validNextStates: ["wipe-rear-transition"],
    requiredOcclusion: "camera-crop",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R09_rear_transition.png",
    id: "wipe-rear-transition",
    direction: "left",
    action: "travel",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-rear-transition.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-giant-rear"],
    validNextStates: ["wipe-exit"],
    requiredOcclusion: "trailer-takeover",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R10_exit_phase.png",
    id: "wipe-exit",
    direction: "left",
    action: "depart",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-exit.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-rear-transition"],
    validNextStates: ["wipe-trailer-hold"],
    requiredOcclusion: "viewport-edge",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R11_trailer_surface_hold.png",
    id: "wipe-trailer-hold",
    direction: "left",
    action: "idle",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-trailer-hold.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-exit"],
    validNextStates: ["wipe-departure-tail"],
    requiredOcclusion: "trailer-takeover",
  },
  {
    packName: "truck_asset_pack_12_images",
    actorType: "red-truck",
    sourceFile: "R12_departure_tail.png",
    id: "wipe-departure-tail",
    direction: "left",
    action: "depart",
    family: "freight-wipe",
    webpFilename: "protagonist-truck-red-wipe-departure-tail.webp",
    convertToWebp: true,
    validPreviousStates: ["wipe-trailer-hold"],
    validNextStates: [],
    requiredOcclusion: "viewport-edge",
  },
  ...HOMEPAGE_HUMAN_REGISTRY,
];

// Invariant: Verify all WebP paths exist or throw immediately
async function verifyWebpExists(webpFilename) {
  const filePath = path.join(protagonistsWebpDir, webpFilename);
  try {
    const meta = await sharp(filePath).metadata();
    if (!meta.width || !meta.height) {
      throw new Error(`WebP file ${webpFilename} is corrupted (zero dimensions)`);
    }
    return `/media/public/protagonists/${webpFilename}`;
  } catch (err) {
    throw new Error(`FATAL INVARIANT VIOLATION: Missing runtime WebP: ${filePath}. Error: ${err.message}`);
  }
}

// Compute normalized bounds of the visible alpha silhouette. Alpha <= 8 is treated as padding.
async function computeVisibleBounds(filePath, width, height) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * info.channels + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`INVARIANT VIOLATION: No visible pixels in actor master: ${filePath}`);
  }

  return {
    x: Number((minX / width).toFixed(6)),
    y: Number((minY / height).toFixed(6)),
    width: Number(((maxX - minX + 1) / width).toFixed(6)),
    height: Number(((maxY - minY + 1) / height).toFixed(6)),
  };
}

// Compute automatic ground contact baseline using alpha channel edge analysis
async function computeAutomaticGroundContact(filePath, width, height) {
  const { data, info } = await sharp(filePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  let lowestY = 0;
  let lowestXSum = 0;
  let lowestCount = 0;

  for (let y = height - 1; y >= 0; y--) {
    let rowOpaqueCount = 0;
    let rowXSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const alpha = channels === 4 ? data[idx + 3] : 255;
      if (alpha > 40) {
        rowOpaqueCount++;
        rowXSum += x;
      }
    }
    if (rowOpaqueCount >= 5 && lowestY === 0) {
      lowestY = y;
      lowestXSum = rowXSum;
      lowestCount = rowOpaqueCount;
      break;
    }
  }

  const contactY = lowestY > 0 ? Number((lowestY / height).toFixed(4)) : 1.0;
  const contactX = lowestCount > 0 ? Number((lowestXSum / lowestCount / width).toFixed(4)) : 0.5;

  return { x: contactX, y: contactY };
}

// Visually audited Van door aperture and sliding door travel calibration
// Assisted by pixel delta density analysis (not pre-clipped heuristic)
async function computeAuditedVanDoorCalibration() {
  const closedLeftFile = path.join(imagesDir, "KT_Courier_Van_Asset_Pack_14_PNGs", "02_full_side_view_facing_left.png");
  const doorOpenFile = path.join(imagesDir, "KT_Courier_Van_Asset_Pack_14_PNGs", "10_side_sliding_door_open.png");

  console.log("Analyzing Van masters for audited door calibration...");
  const [metaClosed, metaOpen, rawClosed, rawOpen] = await Promise.all([
    sharp(closedLeftFile).metadata(),
    sharp(doorOpenFile).metadata(),
    sharp(closedLeftFile).raw().toBuffer({ resolveWithObject: true }),
    sharp(doorOpenFile).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const width = rawClosed.info.width; // 1448
  const height = rawClosed.info.height; // 1086

  // HARD INVARIANT: Canvas geometry must match expected source truth
  if (width !== 1448 || height !== 1086) {
    throw new Error(`INVARIANT VIOLATION: Closed Van master canvas is ${width}x${height}, expected 1448x1086`);
  }
  if (rawOpen.info.width !== 1448 || rawOpen.info.height !== 1086) {
    throw new Error(`INVARIANT VIOLATION: Open Van master canvas is ${rawOpen.info.width}x${rawOpen.info.height}, expected 1448x1086`);
  }
  if (width !== rawOpen.info.width || height !== rawOpen.info.height) {
    throw new Error(`INVARIANT VIOLATION: Van door calibration master dimension mismatch (${width}x${height} vs ${rawOpen.info.width}x${rawOpen.info.height})`);
  }

  // Audit results based on pixel delta density analysis across 1448x1086 canvas:
  // 1. cargoOpeningRect: The dark interior doorway aperture revealed when door slides open.
  // Density spike is bounded between x: [575, 985], y: [215, 795].
  const cargoOpeningRect = {
    x: Number((575 / width).toFixed(4)), // 0.3971
    y: Number((215 / height).toFixed(4)), // 0.1980
    width: Number(((985 - 575) / width).toFixed(4)), // 0.2831
    height: Number(((795 - 215) / height).toFixed(4)), // 0.5341
  };

  // 2. slidingDoorTravelRect: The entire physical boundary spanning the initial door position,
  // the guide rail travel, and the open panel resting position on the rear quarter panel.
  // Bounded between x: [575, 1320], y: [210, 805].
  const slidingDoorTravelRect = {
    x: Number((575 / width).toFixed(4)), // 0.3971
    y: Number((210 / height).toFixed(4)), // 0.1934
    width: Number(((1320 - 575) / width).toFixed(4)), // 0.5145
    height: Number(((805 - 210) / height).toFixed(4)), // 0.5479
  };

  const cargoInsetTop = (cargoOpeningRect.y * 100).toFixed(2);
  const cargoInsetRight = ((1 - (cargoOpeningRect.x + cargoOpeningRect.width)) * 100).toFixed(2);
  const cargoInsetBottom = ((1 - (cargoOpeningRect.y + cargoOpeningRect.height)) * 100).toFixed(2);
  const cargoInsetLeft = (cargoOpeningRect.x * 100).toFixed(2);

  const travelInsetTop = (slidingDoorTravelRect.y * 100).toFixed(2);
  const travelInsetRight = ((1 - (slidingDoorTravelRect.x + slidingDoorTravelRect.width)) * 100).toFixed(2);
  const travelInsetBottom = ((1 - (slidingDoorTravelRect.y + slidingDoorTravelRect.height)) * 100).toFixed(2);
  const travelInsetLeft = (slidingDoorTravelRect.x * 100).toFixed(2);

  return {
    canvas: { width, height },
    method: "visually-audited-pixel-density-assisted",
    clipPathInset: `inset(${cargoInsetTop}% ${cargoInsetRight}% ${cargoInsetBottom}% ${cargoInsetLeft}%)`,
    cargoOpeningRect: {
      raw: { minX: 575, maxX: 985, minY: 215, maxY: 795 },
      normalized: cargoOpeningRect,
      clipPathInset: `inset(${cargoInsetTop}% ${cargoInsetRight}% ${cargoInsetBottom}% ${cargoInsetLeft}%)`,
    },
    slidingDoorTravelRect: {
      raw: { minX: 575, maxX: 1320, minY: 210, maxY: 805 },
      normalized: slidingDoorTravelRect,
      clipPathInset: `inset(${travelInsetTop}% ${travelInsetRight}% ${travelInsetBottom}% ${travelInsetLeft}%)`,
    },
  };
}

// The delivery pack has a different canvas family from the original Hero Van
// assets. Calibrate it independently from the closed approach and fully-open
// delivery masters. This records the actual changed pixel region while keeping
// the complete source canvas available for full-frame state swaps.
async function computeDeliveryVanDoorCalibration() {
  const referenceState = "delivery-center-approach";
  const fullyOpenState = "delivery-door-open-full";
  const referenceFile = path.join(
    imagesDir,
    "KT_Courier_Van_Asset_Pack_14_PNGs",
    "KT_Courier_Van_05.png"
  );
  const fullyOpenFile = path.join(
    imagesDir,
    "KT_Courier_Van_Asset_Pack_14_PNGs",
    "KT_Courier_Van_12.png"
  );

  const [referenceRaw, fullyOpenRaw] = await Promise.all([
    sharp(referenceFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(fullyOpenFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  const width = referenceRaw.info.width;
  const height = referenceRaw.info.height;
  if (width !== fullyOpenRaw.info.width || height !== fullyOpenRaw.info.height) {
    throw new Error(
      `INVARIANT VIOLATION: Delivery Van door calibration canvas mismatch (${width}x${height} vs ${fullyOpenRaw.info.width}x${fullyOpenRaw.info.height})`
    );
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let changedPixelCount = 0;
  const channels = referenceRaw.info.channels;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const alphaDelta = Math.abs(referenceRaw.data[index + 3] - fullyOpenRaw.data[index + 3]);
      const rgbDelta =
        Math.abs(referenceRaw.data[index] - fullyOpenRaw.data[index]) +
        Math.abs(referenceRaw.data[index + 1] - fullyOpenRaw.data[index + 1]) +
        Math.abs(referenceRaw.data[index + 2] - fullyOpenRaw.data[index + 2]);

      if (alphaDelta > 24 || rgbDelta > 48) {
        changedPixelCount++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("INVARIANT VIOLATION: Delivery Van door calibration found no changed pixels");
  }

  const changedRegion = {
    raw: { minX, maxX, minY, maxY },
    normalized: {
      x: Number((minX / width).toFixed(4)),
      y: Number((minY / height).toFixed(4)),
      width: Number(((maxX - minX + 1) / width).toFixed(4)),
      height: Number(((maxY - minY + 1) / height).toFixed(4)),
    },
  };

  const insetTop = (changedRegion.normalized.y * 100).toFixed(2);
  const insetRight = ((1 - (changedRegion.normalized.x + changedRegion.normalized.width)) * 100).toFixed(2);
  const insetBottom = ((1 - (changedRegion.normalized.y + changedRegion.normalized.height)) * 100).toFixed(2);
  const insetLeft = (changedRegion.normalized.x * 100).toFixed(2);

  return {
    canvas: { width, height },
    method: "pixel-delta-density-assisted",
    geometryCompatibleForRegionReplacement: false,
    recommendedMode: "full-frame-state-swaps",
    note: "Changed-pixel density spans the vehicle canvas; do not replace only a door region.",
    referenceState,
    fullyOpenState,
    referenceFile: "KT_Courier_Van_05.png",
    fullyOpenFile: "KT_Courier_Van_12.png",
    changedPixelCount,
    changedRegion,
    clipPathInset: `inset(${insetTop}% ${insetRight}% ${insetBottom}% ${insetLeft}%)`,
  };
}

const RUNTIME_WEBP_OPTIONS = {
  quality: 90,
  alphaQuality: 100,
  effort: 6,
  smartSubsample: true,
};

async function convertRuntimeWebp(entry, rawPath, sourceMeta) {
  const outputPath = path.join(protagonistsWebpDir, entry.webpFilename);
  await sharp(rawPath).webp(RUNTIME_WEBP_OPTIONS).toFile(outputPath);
  const outputMeta = await sharp(outputPath).metadata();

  if (outputMeta.width !== sourceMeta.width || outputMeta.height !== sourceMeta.height) {
    throw new Error(
      `INVARIANT VIOLATION: Runtime WebP geometry changed for ${entry.actorType}:${entry.id} (${outputMeta.width}x${outputMeta.height} vs ${sourceMeta.width}x${sourceMeta.height})`
    );
  }
  if (sourceMeta.hasAlpha && !outputMeta.hasAlpha) {
    throw new Error(`INVARIANT VIOLATION: Runtime WebP lost alpha for ${entry.actorType}:${entry.id}`);
  }

  console.log(
    `Converted ${entry.actorType}:${entry.id} ${entry.sourceFile} -> ${entry.webpFilename} ` +
      `(quality=${RUNTIME_WEBP_OPTIONS.quality}, alphaQuality=${RUNTIME_WEBP_OPTIONS.alphaQuality}, effort=${RUNTIME_WEBP_OPTIONS.effort})`
  );
}

async function main() {
  console.log("=== Phase 1.1: Authoritative Actor Performance Truth Builder ===");
  await mkdir(artifactsMediaDir, { recursive: true });
  await mkdir(path.join(artifactsMediaDir, "contact-sheets"), { recursive: true });
  await mkdir(protagonistsWebpDir, { recursive: true });

  const doorCalibration = await computeAuditedVanDoorCalibration();
  const deliveryDoorCalibration = await computeDeliveryVanDoorCalibration();

  // INVARIANT 1: Total canonical definitions must equal the existing 76
  // runtime states (including the two mirrored collection derivatives) plus
  // the 16 delivery Van and 12 freight wipe states.
  if (CANONICAL_REGISTRY.length !== 128) {
    throw new Error(`INVARIANT VIOLATION: Expected 128 registry entries, got ${CANONICAL_REGISTRY.length}`);
  }

  // INVARIANT 2: Check actor counts per pack
  const counts = { "white-truck": 0, van: 0, courier: 0, "red-truck": 0, recipient: 0, handoff: 0 };
  const idsPerActor = { "white-truck": new Set(), van: new Set(), courier: new Set(), "red-truck": new Set(), recipient: new Set(), handoff: new Set() };

  for (const entry of CANONICAL_REGISTRY) {
    counts[entry.actorType]++;
    if (idsPerActor[entry.actorType].has(entry.id)) {
      throw new Error(`INVARIANT VIOLATION: Duplicate canonical ID '${entry.id}' for actor '${entry.actorType}'`);
    }
    idsPerActor[entry.actorType].add(entry.id);
  }

  if (counts["white-truck"] !== 28 || counts.van !== 32 || counts.courier !== 31 || counts["red-truck"] !== 24 || counts.recipient !== 7 || counts.handoff !== 6) {
    throw new Error(`INVARIANT VIOLATION: Pack count mismatch: ${JSON.stringify(counts)}`);
  }

  const processedStates = [];

  for (const entry of CANONICAL_REGISTRY) {
    const sourcePath = entry.sourcePath ?? entry.sourceFile;
    const rawPath = path.join(imagesDir, entry.packName, sourcePath);
    const webpPath = path.join(protagonistsWebpDir, entry.webpFilename);
    const metadataPath = entry.metadataFromRuntime ? webpPath : rawPath;
    const meta = await sharp(metadataPath).metadata();

    // INVARIANT 3: Real dimensions must exist
    if (!meta.width || !meta.height) {
      throw new Error(`INVARIANT VIOLATION: Zero dimension in master file: ${rawPath}`);
    }

    // New Phase 1 packs are always converted from their ignored PNG masters.
    // Existing Hero and collection WebPs are left untouched to preserve their
    // accepted runtime bytes and metadata.
    if (entry.convertToWebp) {
      await convertRuntimeWebp(entry, rawPath, meta);
    }

    // INVARIANT 4: Runtime WebP must exist and be valid
    const webpSrc = await verifyWebpExists(entry.webpFilename);
    console.log(`Mapping ${entry.actorType}:${entry.id} -> ${entry.sourceFile} -> ${entry.webpFilename}`);
    if (entry.family === "hero-sequence" && !meta.hasAlpha) {
      throw new Error(`INVARIANT VIOLATION: Hero sequence master must preserve alpha: ${rawPath}`);
    }
    const visibleBounds = await computeVisibleBounds(metadataPath, meta.width, meta.height);

    // Compute or apply ground contact
    let groundContact = entry.humanGroundContact;
    let groundContactSource = "human-audited";

    if (!groundContact) {
      const autoContact = await computeAutomaticGroundContact(rawPath, meta.width, meta.height);
      groundContact = autoContact;
      groundContactSource = "automatic";
    }

    const aspectRatio = Number((meta.width / meta.height).toFixed(4));

    processedStates.push({
      id: entry.id,
      actorType: entry.actorType,
      sourceFile: entry.sourceFile,
      webpSrc,
      width: meta.width,
      height: meta.height,
      aspectRatio,
      format: meta.format,
      hasAlpha: Boolean(meta.hasAlpha),
      visibleBounds,
      direction: entry.direction,
      action: entry.action,
      family: entry.family,
      groundContact: {
        x: groundContact.x,
        y: groundContact.y,
        source: groundContactSource,
      },
      validPreviousStates: entry.validPreviousStates,
      validNextStates: entry.validNextStates,
      requiredOcclusion: entry.requiredOcclusion,
    });
  }

  // Compile summary table by actor family directly from processed data
  const summaryByActor = {};
  for (const s of processedStates) {
    if (!summaryByActor[s.actorType]) summaryByActor[s.actorType] = [];
    summaryByActor[s.actorType].push(s);
  }

  const auditManifest = {
    generatedAt: new Date().toISOString(),
    invariants: {
      totalStates: processedStates.length,
      counts,
      zeroDuplicates: true,
      zeroUnknownPaths: true,
      zeroMissingDimensions: true,
      allAuditedFamilies: true,
    },
    doorCalibration,
    deliveryDoorCalibration,
    actors: summaryByActor,
  };

  // Write audit JSON
  const auditPath = path.join(artifactsMediaDir, "actor-performance-audit.json");
  await writeFile(auditPath, JSON.stringify(auditManifest, null, 2), "utf8");
  console.log(`Wrote audit manifest to ${auditPath}`);

  // Generate TypeScript code
  const tsContent = `/**
 * AUTOGENERATED ACTOR PERFORMANCE METADATA (v1.3)
 * Generated by scripts/media/build-actor-performance-manifest.mjs
 * Authoritative source: Local raw PNG masters via sharp.metadata() & visual pixel audit.
 * FAIL-CLOSED: Missing states throw compilation errors.
 * DO NOT EDIT MANUALLY.
 */

export type ConcealmentStrategy =
  | "none"
  | "typography-occlusion"
  | "trailer-takeover"
  | "camera-crop"
  | "road-geometry"
  | "door-sequence"
  | "scene-boundary"
  | "overpass-shadow"
  | "architectural-mask"
  | "custody-seam"
  | "parcel-coverage"
  | "van-door"
  | "viewport-edge";

export interface GeneratedActorState {
  id: string;
  actorType: "white-truck" | "van" | "courier" | "red-truck" | "recipient" | "handoff";
  sourceFile: string;
  webpSrc: string;
  width: number;
  height: number;
  aspectRatio: number;
  hasAlpha: boolean;
  visibleBounds: { x: number; y: number; width: number; height: number };
  direction: "left" | "right" | "front" | "rear" | "top-down" | "turning" | "detail" | "center";
  action: "idle" | "approach" | "travel" | "accelerate" | "brake" | "open" | "close" | "load" | "handoff" | "turn" | "depart" | "carry";
  family: string;
  groundContact: {
    x: number;
    y: number;
    source: "automatic" | "human-audited";
  };
  validPreviousStates: string[];
  validNextStates: string[];
  requiredOcclusion: ConcealmentStrategy;
}

export const VAN_DOOR_CALIBRATION = ${JSON.stringify(doorCalibration, null, 2)} as const;
export const VAN_DELIVERY_DOOR_CALIBRATION = ${JSON.stringify(deliveryDoorCalibration, null, 2)} as const;

export const GENERATED_ACTOR_STATES: Record<string, GeneratedActorState> = {
${processedStates
  .map(
    s => `  "${s.actorType}:${s.id}": {
    id: "${s.id}",
    actorType: "${s.actorType}",
    sourceFile: "${s.sourceFile}",
    webpSrc: "${s.webpSrc}",
    width: ${s.width},
    height: ${s.height},
    aspectRatio: ${s.aspectRatio},
    hasAlpha: ${s.hasAlpha},
    visibleBounds: ${JSON.stringify(s.visibleBounds)},
    direction: "${s.direction}",
    action: "${s.action}",
    family: "${s.family}",
    groundContact: { x: ${s.groundContact.x}, y: ${s.groundContact.y}, source: "${s.groundContact.source}" },
    validPreviousStates: ${JSON.stringify(s.validPreviousStates)},
    validNextStates: ${JSON.stringify(s.validNextStates)},
    requiredOcclusion: "${s.requiredOcclusion}",
  },`
  )
  .join("\n")}
};
`;

  const tsPath = path.join(generatedDir, "generated-actor-media.ts");
  await writeFile(tsPath, tsContent, "utf8");
  console.log(`Wrote TypeScript definitions to ${tsPath}`);

  console.log("=== Phase 1.1 Manifest Generation Completed Successfully ===");
}

main().catch(err => {
  console.error("FATAL ERROR in Phase 1.1 manifest builder:", err);
  process.exit(1);
});
