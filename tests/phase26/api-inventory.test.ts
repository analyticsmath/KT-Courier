import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Phase 26 public, applicant, and admin API contracts", () => {
  it("keeps public careers DTOs free of requisition, screening, and employment-equity evidence", () => {
    const openingService = read("lib/recruitment/opening.service.ts");
    const dto = openingService.slice(openingService.indexOf("return openings.map"), openingService.indexOf("async getOpeningByReference"));
    expect(dto).toContain("noFeeStatement");
    expect(dto).not.toMatch(/requisition(?:Id|:)/);
    expect(dto).not.toMatch(/screeningPolicy|employmentEquity/i);
  });

  it("requires exact issued-version binding for applicant offer acceptance", () => {
    expect(read("app/api/applicant/offers/[reference]/accept/route.ts")).toContain("body.offerVersionReference");
    expect(read("lib/recruitment/offer.service.ts")).toContain("Offer acceptance must bind the exact issued offer version.");
  });

  it("keeps admin lifecycle surfaces permission guarded and uses canonical recruitment services", () => {
    const adminDirectory = path.join(root, "app/api/admin/recruitment");
    const files = fs.readdirSync(adminDirectory, { recursive: true }).filter((entry) => String(entry).endsWith("route.ts"));
    expect(files.length).toBeGreaterThanOrEqual(53);
    for (const entry of files) {
      const route = read(path.join("app/api/admin/recruitment", String(entry)));
      expect(route).toContain("requirePermission");
      expect(route).toMatch(/new \w+Service\(prisma\)/);
    }
  });
});
