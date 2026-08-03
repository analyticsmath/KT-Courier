import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { inspectCatalogMediaContent } from "@/lib/catalog/media/catalog-media-content-validation";
import { catalogPngFixture } from "@/tests/catalog/catalog-media-test-fixtures";

it("computes an immutable-style SHA-256 checksum from server-opened bytes", () => { const bytes = catalogPngFixture(); const result = inspectCatalogMediaContent({ bytes, declaredMimeType: "image/png", declaredByteSize: bytes.byteLength }); expect(result.checksum).toBe(createHash("sha256").update(bytes).digest("hex")); expect(result.checksum).toMatch(/^[0-9a-f]{64}$/); });
