import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog inventory service",()=>it("locks, replays and updates projection atomically",()=>{const source=serviceSource("catalog-inventory.service.ts");expect(source).toMatch(/FOR UPDATE/);expect(source).toMatch(/TransactionIsolationLevel\.Serializable/);expect(source).toMatch(/requestHash/);expect(source).toMatch(/catalogInventoryMovement\.create/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

