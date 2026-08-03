import { type NextRequest } from "next/server";
import { notFound, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getLedgerJournalDetail } from "@/lib/services/ledger-query.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.LEDGER_READ, { request });
  if (auth.response) return auth.response;
  const { id } = await params;

  try {
    const journal = await getLedgerJournalDetail(id);
    return journal ? ok(journal) : notFound("Ledger journal not found.");
  } catch {
    return serviceUnavailable("Ledger journal details are temporarily unavailable.");
  }
}
