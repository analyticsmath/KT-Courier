import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog import service",()=>it("requires dry-run and idempotent request hash",()=>{const source=serviceSource("catalog-import.service.ts");expect(source).toMatch(/assertCatalogImportCanApply/);expect(source).toMatch(/requestHash/);expect(source).not.toMatch(/status:\s*"ACTIVE"/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

