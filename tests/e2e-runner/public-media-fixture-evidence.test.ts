import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("publication test fixture must use verifiable media", () => {
  it("uploads genuine decoded media rather than fabricating a public READY image", () => {
    const source = readFileSync(join(process.cwd(), "tests/e2e/catalog-inventory-upload.spec.ts"), "utf8");
    expect(source).not.toContain('checksum: "a".repeat(64)');
    expect(source).not.toContain('storageProvider: "disposable"');
    expect(source).toContain('/api/store/catalog/media/normalized');
    expect(source).toContain('/api/catalog/media/${asset.publicReference}');
  });
});
