import { describe,it,expect } from "vitest"; import { serviceSource } from "./catalog-service-source-test-helper";
describe("catalog import source contract",()=>it("does not claim unapplied drafts were completed",()=>{const source=serviceSource("catalog-import.service.ts");expect(source).toMatch(/assertCatalogImportCanApply/);expect(source).toMatch(/requestHash/);expect(source).toMatch(/CATALOG_IMPORT_APPLICATION_UNAVAILABLE/);expect(source).not.toMatch(/status:\s*"COMPLETED"/)}));

