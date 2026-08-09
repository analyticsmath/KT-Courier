import { db } from "@/lib/db";
import { UserRole } from "@/types/db";
import { ReportingError } from "./contracts";
import type { ReportActor } from "./authorization";

export async function resolveReportOwnerScope(actor: ReportActor): Promise<Record<string, string>> {
  switch (actor.role) {
    case UserRole.CUSTOMER:
      return { userId: actor.id };
    case UserRole.STORE: {
      const store = await db.store.findFirst({ where: { ownerUserId: actor.id }, select: { id: true } });
      if (!store) throw new ReportingError("REPORT_OWNER_SCOPE_UNAVAILABLE", 403, "A store ownership context is required.");
      return { userId: actor.id, storeId: store.id };
    }
    case UserRole.DRIVER: {
      const driver = await db.driverProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!driver) throw new ReportingError("REPORT_OWNER_SCOPE_UNAVAILABLE", 403, "A driver ownership context is required.");
      return { userId: actor.id, driverProfileId: driver.id };
    }
    case UserRole.PROMOTER: {
      const promoter = await db.promoterAccount.findUnique({ where: { userId: actor.id }, select: { id: true } });
      if (!promoter) throw new ReportingError("REPORT_OWNER_SCOPE_UNAVAILABLE", 403, "A promoter ownership context is required.");
      return { userId: actor.id, promoterId: promoter.id };
    }
    default:
      return { userId: actor.id };
  }
}
