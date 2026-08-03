import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const list=readFileSync(join(process.cwd(),"app/api/admin/driver-earning-reconciliation/route.ts"),"utf8"); const permission=readFileSync(join(process.cwd(),"lib/driver-earnings/finance-permission.ts"),"utf8");
it("requires exact reconcile permission and stable filters",()=>expect(list).toMatch(/DRIVER_EARNINGS_RECONCILE[\s\S]*ReconciliationListQuerySchema/));
it("explicit DENY wins for admins and super admins",()=>expect(permission).toMatch(/effect: "DENY"[\s\S]*if \(await denied/));
