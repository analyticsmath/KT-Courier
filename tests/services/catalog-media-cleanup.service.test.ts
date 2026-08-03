import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const cleanup = readFileSync("scripts/cleanup-expired-catalog-media.mjs", "utf8");
const scan = readFileSync("scripts/scan-catalog-media-integrity.mjs", "utf8");
it("keeps cleanup dry-run bounded source-locked and attachment/history safe", () => { expect(cleanup).toMatch(/DRY_RUN/); expect(cleanup).toMatch(/Math\.min\(.+500/); expect(cleanup).toMatch(/CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED = false/); expect(cleanup).toMatch(/attachedAssetsDeleted: 0/); expect(cleanup).toMatch(/historicalEvidenceDeleted: 0/); expect(cleanup).not.toMatch(/\.delete\(|deleteMany|\$executeRaw/); expect(scan).toMatch(/cross-owner product attachment/); });
