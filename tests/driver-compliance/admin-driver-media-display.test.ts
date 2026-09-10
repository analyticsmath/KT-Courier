import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin driver media display contract", () => {
  const root = process.cwd();
  const consoleSource = readFileSync(
    resolve(root, "components/admin/DriverDetailsConsole.tsx"),
    "utf8",
  );

  it("proves driver profile and vehicle image URLs resolve through /api/private-media/{reference}", () => {
    // Proves driver profile photo uses canonical /api/private-media/ route with encodeURIComponent
    expect(consoleSource).toContain(
      "src={`/api/private-media/${encodeURIComponent(driver.profilePhoto.publicReference)}`}",
    );

    // Proves vehicle media photographs use canonical /api/private-media/ route with encodeURIComponent
    expect(consoleSource).toContain(
      "src={`/api/private-media/${encodeURIComponent(photo.publicReference)}`}",
    );
  });

  it("strictly prohibits using nonexistent /api/driver/private-media retrieval route", () => {
    expect(consoleSource).not.toContain("/api/driver/private-media");
  });

  it("verifies the canonical private-media retrieval route exists and no duplicate driver route exists", () => {
    expect(existsSync(resolve(root, "app/api/private-media/[reference]/route.ts"))).toBe(true);
    expect(existsSync(resolve(root, "app/api/driver/private-media/[reference]/route.ts"))).toBe(false);
  });
});
