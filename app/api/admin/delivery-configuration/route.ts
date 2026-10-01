import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  deliveryCatalog,
  saveDeliveryConfiguration,
} from "@/lib/client-platform/delivery.service";
import { DeliveryConfigurationSchema } from "@/lib/client-platform/contracts";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function GET() {
  const a = await requireAdminApiPermission(
    PERMISSIONS.COMMERCIAL_CONFIGURATION_READ,
  );
  if (a.response) return a.response;
  try {
    return json(await deliveryCatalog(true));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const a = await requireAdminApiPermission(
    PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE,
  );
  if (a.response) return a.response;
  const b = await mutation(req, `delivery-config:${a.user.id}`);
  if ("response" in b) return b.response;
  const p = DeliveryConfigurationSchema.safeParse(b.body);
  if (!p.success)
    return json(
      { error: "Provide valid service tariffs, coverage and an audit reason." },
      422,
    );
  try {
    return json(await saveDeliveryConfiguration(a.user.id, p.data));
  } catch (e) {
    return failure(e);
  }
}
