import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"app/api/driver/earnings/[publicReference]/route.ts"),"utf8");
it("resolves ownership by user and safe public reference",()=>expect(source).toMatch(/DriverEarningPublicReferenceParamsSchema[\s\S]*getDriverEarningForOwner\(user\.id/));
