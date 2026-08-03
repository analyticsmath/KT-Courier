import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Phase 27 component surfaces", () => {
  it("reuses one canonical notification centre across product roles", () => {
    const component = join(process.cwd(), "components", "notifications", "NotificationCentre.tsx");
    expect(existsSync(component)).toBe(true);
    for (const page of ["app/(account)/account/notifications/page.tsx", "app/(store)/store/notifications/page.tsx", "app/(driver)/driver/notifications/page.tsx", "app/(account)/promoter/notifications/page.tsx", "app/(account)/applicant/notifications/page.tsx", "app/(admin)/admin/notifications/page.tsx"]) expect(readFileSync(join(process.cwd(), page), "utf8")).toContain("NotificationCentre");
  });

  it("has source-backed admin loading, locked, empty and error states", () => {
    const surface = readFileSync(join(process.cwd(), "components", "notifications", "AdminNotificationSurface.tsx"), "utf8");
    expect(surface).toContain("findMany");
    expect(surface).toContain("LOCKED");
    expect(surface).toContain("No ");
    expect(existsSync(join(process.cwd(), "app/(admin)/admin/notifications/loading.tsx"))).toBe(true);
    expect(existsSync(join(process.cwd(), "app/(admin)/admin/notifications/error.tsx"))).toBe(true);
  });
});
