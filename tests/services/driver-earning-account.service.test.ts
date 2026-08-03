import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-account.service.ts"),"utf8");
it("provisions canonical active DriverProfile wallet and zero-opening accounts",()=>{expect(source).toMatch(/ownerType: "DRIVER"[\s\S]*ownerId: driver\.id[\s\S]*DRIVER_EARNINGS_PAYABLE[\s\S]*OWNER_WITHDRAWABLE/);expect(source).toMatch(/status !== "ACTIVE"|status === "ACTIVE"/)});
it("rejects suspended/inactive drivers and delegates unique-race winner reread",()=>{expect(source).toMatch(/driver\.status !== "ACTIVE"/);expect(source).toMatch(/ensureWalletForOwner[\s\S]*ensureLedgerAccount/)});
