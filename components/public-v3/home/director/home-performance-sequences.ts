import { clamp01, range } from "./home-beats";

const boxRoot = "/media/public/KT_BOX_SEQUENCE_8_FRAMES/";
const vanRoot = "/media/public/KT_Courier_White_Van_Courier_Performance_Pack/";
const handoffRoot = "/media/public/KT_COURIER_HANDOFF_12_PNGS/";

export const BOX_PLATES = [
  "box_00_open_master", "box_01_side_flaps_early", "box_02_side_flaps_mid",
  "box_03_side_flaps_closed", "box_04_rear_flap_early", "box_05_rear_flap_near_closed",
  "box_06_front_flap_mid", "box_07_closed",
].map((name) => `${boxRoot}${name}.png`);

export const PICKUP_PLATES = [
  "pickup_A00_van_closed_right", "pickup_A01_door_15", "pickup_A02_door_35",
  "pickup_A03_door_60", "pickup_A04_door_85", "pickup_A05_door_open",
  "pickup_A06_courier_approach_box", "pickup_A07_courier_at_door",
  "pickup_A08_load_start", "pickup_A09_load_half", "pickup_A10_load_near_inside",
  "pickup_A11_parcel_released", "pickup_A12_courier_withdraw", "pickup_A13_courier_clear",
  "pickup_A14_door_closing_60", "pickup_A15_door_closing_25", "pickup_A16_ready_depart",
].map((name) => `${vanRoot}${name}.png`);

export const DELIVERY_PLATES = [
  "delivery_B00_van_closed_left", "delivery_B01_door_15", "delivery_B02_door_35",
  "delivery_B03_door_60", "delivery_B04_door_85", "delivery_B05_door_open",
  "delivery_B06_courier_emerging", "delivery_B07_courier_threshold_box",
  "delivery_B08_courier_out_box", "delivery_B09_walk_right_01",
  "delivery_B10_walk_right_02", "delivery_B11_handoff_entry_match",
].map((name) => `${vanRoot}${name}.png`);

export const HANDOFF_PLATES = [
  "handoff_01_approach", "handoff_02_arrival", "handoff_03_recipient_reach",
  "handoff_04_first_contact", "handoff_05_shared_parcel", "handoff_06_weight_transfer",
  "handoff_07_release", "handoff_08_withdrawal", "handoff_09_separation_begin",
  "handoff_10_departure_step", "handoff_11_walking_apart", "handoff_12_final_separation",
].map((name) => `${handoffRoot}${name}.png`);

export const RETURN_PLATES = [
  "return_C01_walk_left", "return_C02_approach_van", "return_C03_enter_van",
  "return_C04_inside", "return_C05_door_closing_60",
  "return_C06_door_closing_25", "return_C07_departure_ready",
].map((name) => `${vanRoot}${name}.png`);

/** Inclusive scroll windows preserve each pose at the stage boundaries. */
export function plateIndex(progress: number, start: number, end: number, first: number, last: number): number {
  return first + Math.min(last - first, Math.floor(clamp01(range(progress, start, end)) * (last - first + 1)));
}

export function pickupPlateIndex(p: number): number {
  if (p < .20) return 0;
  if (p < .38) return plateIndex(p, .20, .38, 1, 5);
  if (p < .50) return plateIndex(p, .38, .50, 6, 7);
  if (p < .65) return plateIndex(p, .50, .65, 8, 11);
  if (p < .72) return plateIndex(p, .65, .72, 12, 13);
  if (p < .88) return plateIndex(p, .72, .88, 14, 15);
  return 16;
}

export function deliveryPlateIndex(p: number): number {
  if (p < .18) return 0;
  if (p < .33) return plateIndex(p, .18, .33, 1, 5);
  if (p < .43) return plateIndex(p, .33, .43, 6, 8);
  return plateIndex(p, .43, .53, 9, 11);
}

export function isTightVanPlate(src: string): boolean {
  return /(?:pickup_A(?:08|09|10|11|12|13)|delivery_B(?:06|07|08)|return_C(?:01|02|03))_/.test(src);
}
