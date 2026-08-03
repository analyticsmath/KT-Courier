import { describe, expect, it } from "vitest";
import { inspectCatalogMediaContent } from "@/lib/catalog/media/catalog-media-content-validation";
import { catalogPngFixture } from "@/tests/catalog/catalog-media-test-fixtures";

describe("catalog media content validation", () => {
  it("derives PNG MIME dimensions and size from bytes", () => { const bytes = catalogPngFixture(); expect(inspectCatalogMediaContent({ bytes, declaredMimeType: "image/png", declaredByteSize: bytes.byteLength })).toMatchObject({ detectedMimeType: "image/png", width: 400, height: 400, privacyInspectionPassed: true }); });
  it("rejects MIME mismatch invalid magic size mismatch metadata and excessive pixels", () => { const bytes = catalogPngFixture(); expect(() => inspectCatalogMediaContent({ bytes, declaredMimeType: "image/jpeg", declaredByteSize: bytes.byteLength })).toThrow(); expect(() => inspectCatalogMediaContent({ bytes: Uint8Array.of(1, 2, 3), declaredMimeType: "image/png", declaredByteSize: 3 })).toThrow(); expect(() => inspectCatalogMediaContent({ bytes, declaredMimeType: "image/png", declaredByteSize: bytes.byteLength + 1 })).toThrow(); const metadata = catalogPngFixture({ metadata: true }); expect(() => inspectCatalogMediaContent({ bytes: metadata, declaredMimeType: "image/png", declaredByteSize: metadata.byteLength })).toThrow(); const huge = catalogPngFixture({ width: 8_000, height: 8_000 }); expect(() => inspectCatalogMediaContent({ bytes: huge, declaredMimeType: "image/png", declaredByteSize: huge.byteLength })).toThrow(); });
});
