import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = ["app/(admin)/admin/catalog/media/page.tsx", "app/(admin)/admin/catalog/media/[id]/page.tsx", "components/catalog/CatalogMediaReviewControls.tsx"].map((path) => readFileSync(path, "utf8")).join("\n");
it("shows safe owner validation association history quarantine rejection and checksum evidence", () => { for (const token of ["Owner scope", "Owning store", "MIME", "Byte size", "Dimensions", "Checksum fingerprint", "Attached catalog records", "Immutable history", "Quarantine", "Reject"]) expect(source).toContain(token); expect(source).not.toMatch(/\bstorageKey\b|uploadToken|accessKey|secretKey/); });
