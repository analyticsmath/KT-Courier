import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStorePickupOperationalPreflight } from "@/lib/admin/store-pickup-preflight.service";
import { notFound, serverError } from "@/lib/api/response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_READ, { request: req });
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const result = await getStorePickupOperationalPreflight(id);
    if (!result) return notFound("Store not found.");
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return serverError("Store pickup preflight is temporarily unavailable.");
  }
}
