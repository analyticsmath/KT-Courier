import { type NextRequest } from "next/server";
import { badRequest, notFound, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getLedgerAccountDetail } from "@/lib/services/ledger-query.service";
import { LedgerPaginationSchema, searchParamsToObject } from "@/lib/validation/ledger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.LEDGER_READ, { request });
  if (auth.response) return auth.response;

  const query = LedgerPaginationSchema.safeParse(searchParamsToObject(request.nextUrl.searchParams));
  if (!query.success) return badRequest("Invalid ledger entry pagination.");
  const { id } = await params;

  try {
    const account = await getLedgerAccountDetail(id, query.data);
    return account ? ok(account) : notFound("Ledger account not found.");
  } catch {
    return serviceUnavailable("Ledger account details are temporarily unavailable.");
  }
}

