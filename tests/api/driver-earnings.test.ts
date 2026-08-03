import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"app/api/driver/earnings/route.ts"),"utf8");
it("is authenticated active-driver GET-only with pagination filters",()=>{expect(source).toMatch(/export async function GET[\s\S]*role !== "DRIVER"[\s\S]*DriverEarningListQuerySchema/);expect(source).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/)});
