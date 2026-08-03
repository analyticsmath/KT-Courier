import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
const root = process.cwd(); const services = ["driver-earning-accrual.service.ts", "driver-earning-release.service.ts", "driver-earning-reversal.service.ts", "driver-earning-refund.service.ts"].map((file) => readFileSync(join(root, "lib/services", file), "utf8")).join("\n");
it("has no dispatch, completion, order or payment writer", () => expect(services).not.toMatch(/\b(?:tx\.)?(?:order|payment|orderAssignment|driverProfile|proofOfDelivery)\.(?:create|update|updateMany|upsert|delete)/));
it("has no public financial mutation route", () => { const routes = readFileSync(join(root, "app/api/driver/earnings/route.ts"), "utf8") + readFileSync(join(root, "app/api/driver/earnings/summary/route.ts"), "utf8"); expect(routes).not.toMatch(/export async function (?:POST|PUT|PATCH|DELETE)/); });
it("does not duplicate store earning behavior", () => expect(services).not.toMatch(/storeEarning\.(?:create|update|delete)|STORE_EARNING_(?:ACCRUAL|RELEASE|REVERSAL)/));
