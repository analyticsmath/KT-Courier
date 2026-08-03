import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog publication service",()=>it("builds private-safe immutable snapshots behind lock",()=>{const source=serviceSource("catalog-publication.service.ts");expect(source).toMatch(/assertCatalogProductionActivationAllowed/);expect(source).toMatch(/assertSnapshotContainsNoPrivateKeys/);expect(source).toMatch(/status:\s*publish \? "PUBLISHED" : "BLOCKED"/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

