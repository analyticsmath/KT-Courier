import { type NextRequest } from "next/server";
import { badRequest, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listLedgerJournals } from "@/lib/services/ledger-query.service";
import { LedgerJournalQuerySchema, searchParamsToObject } from "@/lib/validation/ledger";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.LEDGER_READ, { request });
  if (auth.response) return auth.response;

  const parsed = LedgerJournalQuerySchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Invalid ledger journal filters.");

  try {
    return ok(await listLedgerJournals(parsed.data));
  } catch {
    return serviceUnavailable("Ledger journals are temporarily unavailable.");
  }
}

