import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok } from "@/lib/api/response";
import { listProcessorRuns } from "@/lib/processors/lease-authority";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROCESSORS_READ, { request });
  if (auth.response) return auth.response;

  const { name } = await params;
  const runs = await listProcessorRuns(name, 50);
  return ok({ data: runs });
}
