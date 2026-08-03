import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CatalogMediaDeliveryService, assertCatalogMediaPublicDeliveryEvidence } from "@/lib/catalog/media/catalog-media-delivery";
import { DeterministicCatalogMediaStorageAdapter } from "@/lib/catalog/media/deterministic-catalog-media-storage-adapter";

const publicBytes = Uint8Array.of(1, 2, 3);
const evidence = { publicReference: "CMA-PUBLIC", storageKey: "internal-key", status: "READY", mimeType: "image/png", byteSize: 3, checksum: createHash("sha256").update(publicBytes).digest("hex"), privacyInspectionPassed: true, associationRole: "PRIMARY", productPublicationStatus: "PUBLISHED", snapshotStatus: "PUBLISHED" };
describe("catalog media public delivery", () => {
  it("requires READY non-document publication evidence", () => { expect(() => assertCatalogMediaPublicDeliveryEvidence(evidence)).not.toThrow(); expect(() => assertCatalogMediaPublicDeliveryEvidence({ ...evidence, status: "QUARANTINED" })).toThrow(); expect(() => assertCatalogMediaPublicDeliveryEvidence({ ...evidence, associationRole: "COMPLIANCE_DOCUMENT" })).toThrow(); expect(() => assertCatalogMediaPublicDeliveryEvidence({ ...evidence, snapshotStatus: "BLOCKED" })).toThrow(); });
  it("returns checksum-verified bytes and controlled headers without storage identity", async () => { const storage = new DeterministicCatalogMediaStorageAdapter(); storage.seedObjectForTesting("internal-key", publicBytes); const service = new CatalogMediaDeliveryService({ findPublicEvidence: async () => evidence }, storage, { approved: true, adapterCode: "DETERMINISTIC_TEST" }); const result = await service.deliver("CMA-PUBLIC"); expect([...result.body]).toEqual([1, 2, 3]); expect(result.headers).toMatchObject({ "Content-Type": "image/png", "X-Content-Type-Options": "nosniff" }); expect(JSON.stringify(result.headers)).not.toContain("internal-key"); storage.seedObjectForTesting("internal-key", Uint8Array.of(3, 2, 1)); await expect(service.deliver("CMA-PUBLIC")).rejects.toMatchObject({ code: "CATALOG_MEDIA_DELIVERY_CHECKSUM_MISMATCH" }); });
});
