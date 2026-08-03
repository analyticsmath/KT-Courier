import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { assertDriverCommissionAttribution } from "@/lib/driver-earnings/driver-commission-attribution";
const allocation = { id: "a", publicReference: "CA-A", amount: new Prisma.Decimal(10), storeAttributedAmount: new Prisma.Decimal(4), driverAttributedAmount: new Prisma.Decimal(2), status: "ACCRUED", accrualStatus: "ACCRUED" };
it("allows only remaining combined attribution", () => expect(() => assertDriverCommissionAttribution([{ commissionAllocationId: "a", commissionAllocationPublicReference: "CA-A", amount: "4.00" }], [allocation])).not.toThrow());
it("blocks combined over-attribution", () => expect(() => assertDriverCommissionAttribution([{ commissionAllocationId: "a", commissionAllocationPublicReference: "CA-A", amount: "4.01" }], [allocation])).toThrow());
