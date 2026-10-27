import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageDisposableCatalogMedia } from "@/scripts/e2e-catalog-media-startup.mjs";

describe("disposable storefront media staging", () => {
  it("stages seed images from bundled read-only media to writable runtime storage without overwriting uploaded files", () => {
    const root=mkdtempSync(join(tmpdir(),"kt-media-stage-"));
    try {
      const bundled=join(root,"bundled"); const writable=join(root,"runtime");
      mkdirSync(bundled);mkdirSync(writable);
      writeFileSync(join(bundled,"checksum.webp"),"demo-image");
      writeFileSync(join(writable,"uploaded.webp"),"customer-upload");
      stageDisposableCatalogMedia(bundled,writable);
      expect(readFileSync(join(writable,"checksum.webp"),"utf8")).toBe("demo-image");
      expect(readFileSync(join(writable,"uploaded.webp"),"utf8")).toBe("customer-upload");
      expect(existsSync(join(bundled,"checksum.webp"))).toBe(true);
    } finally {rmSync(root,{recursive:true,force:true})}
  });
});
