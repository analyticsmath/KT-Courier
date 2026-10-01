import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import {
  PaymentConfigurationSchema,
  listPaymentConfigurations,
  savePaymentConfiguration,
} from "@/lib/client-platform/payment-configuration.service";
import { json, failure, mutation } from "@/lib/client-platform/api";
export async function GET() {
  const a = await requireAdminApiPermission("cod_operations.manage");
  if (a.response) return a.response;
  try {
    return json(await listPaymentConfigurations(a.user));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  const a = await requireAdminApiPermission("cod_operations.manage");
  if (a.response) return a.response;
  const b = await mutation(req, `payment-policy:${a.user.id}`);
  if ("response" in b) return b.response;
  const p = PaymentConfigurationSchema.safeParse(b.body);
  if (!p.success)
    return json(
      { error: p.error.issues[0]?.message ?? "Provide a valid policy." },
      422,
    );
  try {
    return json(await savePaymentConfiguration(a.user, p.data), 201);
  } catch (e) {
    return failure(e);
  }
}
