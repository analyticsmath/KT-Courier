import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"lib/services/driver-earning-summary.service.ts"),"utf8");
it("uses database Decimal and exposes every exact dashboard metric",()=>expect(source).toMatch(/Prisma\.Decimal[\s\S]*totalAccrued[\s\S]*payableBalance[\s\S]*refundReserved[\s\S]*refunded[\s\S]*releaseEligible[\s\S]*releasedToOwnerWithdrawable[\s\S]*reversed[\s\S]*reconciliationCount[\s\S]*oldestUnreleased[\s\S]*recentReleases/));
