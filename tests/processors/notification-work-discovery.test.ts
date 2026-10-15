import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { hasRequiredDomainNotificationWork } from "@/lib/notifications/required-domain-intake";

describe("canonical notification work discovery", () => {
  it("recognizes a canonical event before any outbox row exists, without writing", async () => {
    const query = vi.fn().mockResolvedValue([{ sourceEventId: "canonical-history" }]);
    expect(await hasRequiredDomainNotificationWork({ $queryRaw: query } as unknown as Prisma.TransactionClient)).toBe(true);
    expect(query).toHaveBeenCalledOnce();
    const sql = query.mock.calls[0][0].strings.join("?");
    expect(sql).toContain('FROM "PaymentStatusHistory"'); expect(sql).toContain('NOT EXISTS (SELECT 1 FROM "NotificationEventIntent"');
    expect(sql).not.toMatch(/INSERT|UPDATE|DELETE/);
  });
  it("returns idle only when canonical work is absent and is wired into subsequent worker cycles", async () => {
    expect(await hasRequiredDomainNotificationWork({ $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as Prisma.TransactionClient)).toBe(false);
    const worker = readFileSync("scripts/production-processors.ts", "utf8");
    expect(worker).toContain("return await hasRequiredDomainNotificationWork(prisma) ||");
    expect(worker).toContain("createProductionCycleWorkCheck(hasWork, firstCycle)");
  });
});
