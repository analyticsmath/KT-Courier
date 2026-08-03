import { describe, expect, it } from "vitest";
import { assertCatalogMediaAssetTransition, assertCatalogMediaUploadTransition } from "@/lib/catalog/media/catalog-media-lifecycle";

describe("catalog media lifecycle", () => {
  it("supports inspection quarantine and archive paths", () => { expect(() => assertCatalogMediaAssetTransition("PENDING_UPLOAD", "UPLOADED")).not.toThrow(); expect(() => assertCatalogMediaAssetTransition("UPLOADED", "VALIDATING")).not.toThrow(); expect(() => assertCatalogMediaAssetTransition("VALIDATING", "READY")).not.toThrow(); expect(() => assertCatalogMediaAssetTransition("READY", "QUARANTINED")).not.toThrow(); expect(() => assertCatalogMediaAssetTransition("ARCHIVED", "READY")).toThrow(); });
  it("allows one terminal upload completion", () => { expect(() => assertCatalogMediaUploadTransition("UPLOADED", "COMPLETED")).not.toThrow(); expect(() => assertCatalogMediaUploadTransition("COMPLETED", "COMPLETED")).toThrow(); });
});
