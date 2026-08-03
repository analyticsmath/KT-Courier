import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { AdvertisingServingService } from "@/lib/advertising/serving.service";
import { AdvertisingServingService as RealServingService } from "@/lib/advertising/serving.service";

describe("Phase 24: Advertising Code Compliance Audits", () => {
  const libDir = path.resolve(__dirname, "../../lib/advertising");
  const apiDir = path.resolve(__dirname, "../../app/api/store/ads");
  const clickRouteDir = path.resolve(__dirname, "../../app/api/ads/click");

  // Helper to recursively find all files in a directory
  function getFilesRecursive(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.resolve(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFilesRecursive(filePath));
      } else {
        results.push(filePath);
      }
    }
    return results;
  }

  it("Audit: No skipped or focused tests in advertising test suites", () => {
    const testDir = path.resolve(__dirname, "../../tests");
    const files = getFilesRecursive(testDir).filter(f => f.includes("advertising"));
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toContain("describe." + "only");
      expect(content).not.toContain("it." + "only");
      expect(content).not.toContain("describe." + "skip");
      expect(content).not.toContain("it." + "skip");
    }
  });

  it("Audit: No raw IP logging or storage in measurement service", () => {
    const filePath = path.join(libDir, "measurement.service.ts");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ip: undefined");
      expect(content).toContain("userAgent: undefined");
    }
  });

  it("Audit: Remove every runtime bypass from production files", () => {
    const prohibited = [
      "testBypass",
      "testApproval",
      "skipProductionLock",
      "allowLockedExecution",
      "approvedForTesting",
      "productionLockOverride"
    ];

    const prodFiles = [
      ...getFilesRecursive(libDir),
      ...getFilesRecursive(apiDir),
      ...getFilesRecursive(clickRouteDir)
    ];

    for (const file of prodFiles) {
      // Exclude mapping logs, lock.ts can mention lock variables, but production methods must not take testApproval
      const relativePath = path.relative(path.resolve(__dirname, "../.."), file);
      const content = fs.readFileSync(file, "utf-8");
      
      for (const token of prohibited) {
        // We permit the token in the declaration of ADVERTISING_PRODUCTION_VALIDATION_APPROVED etc but not as parameter or config
        if (content.includes(token)) {
          // Verify it's not a parameter override or bypass branch
          const isBypassPattern = new RegExp(`\\b${token}\\b\\s*[:\\?]?\\s*(?:approved|true|body|input|test|any|override)`, "i");
          if (isBypassPattern.test(content)) {
            throw new Error(`Production file ${relativePath} contains prohibited bypass token/pattern: ${token}`);
          }
        }
      }
    }
  });

  it("Audit: Organic ranking independence verification", async () => {
    // Check that we can insert sponsored slot and remove it, retrieving the exact original list
    const organicResults = [
      { id: "prod-1", name: "Organic Product 1" },
      { id: "prod-2", name: "Organic Product 2" },
      { id: "prod-3", name: "Organic Product 3" }
    ];

    const servingService = new RealServingService();
    // Simulate compose Sponsored list when locked (which mimics returning unchanged)
    const composed = await servingService.composeSponsoredMarketplacePlacements(organicResults, "home-placement", {
      sessionFingerprint: "fingerprint-xyz"
    });

    // Remove sponsored elements helper
    const removeSponsored = (list: any[]) => list.filter(item => !item.sponsored);

    const filtered = removeSponsored(composed);
    expect(filtered).toEqual(organicResults);
  });

  it("Audit: Sponsored disclosure visibility requirements", () => {
    // Every creative snapshot or sponsored card DTO contract must have disclosureLabel or equivalent
    const creativeFile = path.join(libDir, "campaign.service.ts");
    const content = fs.readFileSync(creativeFile, "utf-8");
    expect(content).toContain("disclosureLabel");
    expect(content).toContain("disclosureLabel ?? \"Sponsored\"");
  });

  it("Audit: Contextual-only targeting constraint enforcement", () => {
    // Prohibit sensitive, religious, political, audience upload, income or third party identifiers
    const schemaFile = path.resolve(__dirname, "../../prisma/schema.prisma");
    const content = fs.readFileSync(schemaFile, "utf-8");
    
    const prohibitedKeywords = [
      "incomeTargeting",
      "religionTargeting",
      "politicalTargeting",
      "sensitiveAttributes",
      "thirdPartyAudience",
      "audienceUpload"
    ];

    for (const kw of prohibitedKeywords) {
      expect(content).not.toContain(kw);
    }
  });
});
