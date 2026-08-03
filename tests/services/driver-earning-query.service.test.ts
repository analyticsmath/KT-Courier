import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-query.service.ts"),"utf8");
it("enforces canonical active driver ownership and stable pagination",()=>expect(source).toMatch(/role !== "DRIVER"[\s\S]*driverId: driver\.id[\s\S]*createdAt: "desc"[\s\S]*id: "desc"/));
it("driver DTO excludes PII and internal account IDs",()=>expect(source.match(/function driverItem[\s\S]*?\n}/)?.[0]??"").not.toMatch(/customer|payableAccountId|walletId|completionEvidenceReference/));
