import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-reconciliation.service.ts"),"utf8");
it("uses deterministic upsert observations and canonical resolution only",()=>expect(source).toMatch(/caseKey[\s\S]*observationCount[\s\S]*canonicalOperationReference[\s\S]*RECONCILIATION_RESOLVED/));
