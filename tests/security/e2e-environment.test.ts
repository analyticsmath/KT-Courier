import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("disposable browser origin isolation", () => {
  it("uses the allocated port and passes it through Compose without a production default", async () => {
    // The helper has no process.env writes or inherited production origin values.
    const { disposableBrowserOrigins } = await import("../../scripts/e2e-environment.mjs");
    const before = process.env.ALLOWED_ORIGINS;
    expect(disposableBrowserOrigins(46173)).toBe("http://localhost:46173,http://127.0.0.1:46173");
    expect(process.env.ALLOWED_ORIGINS).toBe(before);
    expect(() => disposableBrowserOrigins(0)).toThrow();
    expect(readFileSync("compose.yml", "utf8")).toContain("ALLOWED_ORIGINS: ${ALLOWED_ORIGINS:-}");
    expect(readFileSync("scripts/e2e-test.mjs", "utf8")).toContain("ALLOWED_ORIGINS: disposableBrowserOrigins(appPort)");
    for (const file of ["Dockerfile", "Dockerfile.operations", "vercel.json"]) {
      expect(readFileSync(file, "utf8")).not.toContain("disposableBrowserOrigins");
    }
  });
});
