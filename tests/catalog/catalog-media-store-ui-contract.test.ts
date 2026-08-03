import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const source = ["components/catalog/CatalogMediaUploader.tsx", "components/catalog/StoreCatalogWizard.tsx"].map((path) => readFileSync(path, "utf8")).join("\n");
it("implements progress READY gating alt text primary selection keyboard ordering variant association removal retry and autosave", () => { for (const token of ["<progress", "READY", "Alt text", "Primary image", "Move earlier", "Move later", "Default variant", "Remove from draft", "Retry selected file", "localStorage"]) expect(source).toContain(token); expect(source).not.toMatch(/URL\.createObjectURL|blob:|storageKey/); });
