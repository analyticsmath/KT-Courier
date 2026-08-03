import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const route=readFileSync(join(process.cwd(),"app/api/admin/driver-earnings/[id]/reverse/route.ts"),"utf8"); const schema=readFileSync(join(process.cwd(),"lib/validation/driver-earnings.ts"),"utf8");
it("requires exact permission same-origin body/rate preparation and strict reviewed schema",()=>expect(route).toMatch(/DRIVER_EARNINGS_REVERSE[\s\S]*prepareDriverEarningReversalMutation[\s\S]*DriverEarningReversalSchema/));
it("accepts no amount account wallet driver status or direction field",()=>{const body=schema.match(/DriverEarningReversalSchema[\s\S]*?\.strict\(\)/)?.[0]??"";expect(body).not.toMatch(/\b(?:amount|account|wallet|driverId|status|direction)\b/)});
