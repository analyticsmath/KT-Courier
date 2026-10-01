import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { listCashDeposits } from "@/lib/client-platform/driver-cash.service";
import { json, failure } from "@/lib/client-platform/api";
export async function GET() {
  const a = await requireAdminApiPermission("cod_operations.manage");
  if (a.response) return a.response;
  try {
    return json({ deposits: await listCashDeposits(a.user) });
  } catch (e) {
    return failure(e);
  }
}
