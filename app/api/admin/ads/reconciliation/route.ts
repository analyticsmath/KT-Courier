import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, serverError } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ADVERTISING_RECONCILIATION_READ, { request });
  if (auth.response) return auth.response;

  try {
    const cases = await prisma.advertisingReconciliationCase.findMany({
      orderBy: { openedAt: "desc" }
    });
    return ok(cases);
  } catch {
    return serverError();
  }
}
