import { type NextRequest } from "next/server";
import { badRequest, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listLedgerAccounts } from "@/lib/services/ledger-query.service";
import { LedgerAccountQuerySchema, searchParamsToObject } from "@/lib/validation/ledger";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.LEDGER_READ, { request });
  if (auth.response) return auth.response;

  const parsed = LedgerAccountQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Invalid ledger account filters.");

  try {
    return ok(await listLedgerAccounts(parsed.data));
  } catch {
    return serviceUnavailable("Ledger accounts are temporarily unavailable.");
  }
}

