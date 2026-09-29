import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOX_PLATES, DELIVERY_PLATES, HANDOFF_PLATES, PICKUP_PLATES, RETURN_PLATES, deliveryPlateIndex, isTightVanPlate, pickupPlateIndex, plateIndex } from "@/components/public-v3/home/director/home-performance-sequences";

describe("committed performance plates", () => {
  it("references every original authored state in order", () => {
    expect([BOX_PLATES.length, PICKUP_PLATES.length, DELIVERY_PLATES.length, HANDOFF_PLATES.length, RETURN_PLATES.length]).toEqual([8, 17, 12, 12, 7]);
    for (const src of [...BOX_PLATES, ...PICKUP_PLATES, ...DELIVERY_PLATES, ...HANDOFF_PLATES, ...RETURN_PLATES]) {
      expect(existsSync(`public${src}`), src).toBe(true);
    }
  });

  it("scrubs each door, load, handoff and return in one direction", () => {
    for (const resolve of [pickupPlateIndex, deliveryPlateIndex]) {
      let previous = -1;
      for (let step = 0; step <= 1000; step++) {
        const frame = resolve(step / 1000);
        expect(frame).toBeGreaterThanOrEqual(previous);
        previous = frame;
      }
    }
    expect(pickupPlateIndex(1)).toBe(16);
    expect(deliveryPlateIndex(.53)).toBe(11);
    expect(plateIndex(.77, .53, .77, 0, 11)).toBe(11);
    expect(isTightVanPlate(PICKUP_PLATES[9])).toBe(true);
    expect(isTightVanPlate(PICKUP_PLATES[7])).toBe(false);
  });
});
