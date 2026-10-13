import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOX_PLATES,
  DELIVERY_PLATES,
  HANDOFF_PLATES,
  PICKUP_PLATES,
  RETURN_PLATES,
} from "@/components/public-v3/home/director/home-performance-sequences";

describe("homepage cinematic plate delivery budget", () => {
  it("serves real WebP derivatives while preserving transparent PNG source masters", () => {
    const plates = [...BOX_PLATES, ...PICKUP_PLATES, ...DELIVERY_PLATES, ...HANDOFF_PLATES, ...RETURN_PLATES];
    expect(plates).toHaveLength(56);
    let originalBytes = 0;
    let optimizedBytes = 0;

    for (const publicPath of plates) {
      expect(publicPath).toMatch(/\.webp$/);
      const derivative = `public${publicPath}`;
      const master = derivative.replace(/\.webp$/, ".png");
      const signature = readFileSync(derivative).subarray(0, 12);

      expect(signature.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(signature.subarray(8, 12).toString("ascii")).toBe("WEBP");
      const optimizedSize = statSync(derivative).size;
      const masterSize = statSync(master).size;
      expect(optimizedSize).toBeLessThan(masterSize);

      originalBytes += masterSize;
      optimizedBytes += optimizedSize;
    }

    // Protect the first-load transfer budget without sacrificing any scroll pose.
    expect(optimizedBytes).toBeLessThan(originalBytes * 0.25);
  });
});
