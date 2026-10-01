import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { readPublicQuote } from "@/lib/client-platform/delivery.service";
import { storeAccess } from "@/lib/client-platform/store-access";
import {
  resolvePaymentBreakdown,
  PaymentPolicyError,
} from "@/lib/payments/payment-policy.service";
import { json, failure } from "@/lib/client-platform/api";
export async function GET(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  const u = await getCurrentUser();
  if (!u || u.status !== "ACTIVE")
    return json({ error: "Sign in to view payment methods." }, 401);
  try {
    const q = await readPublicQuote((await c.params).id, u.id);
    const methods = [
      {
        mode: "DIGITAL_ONLY",
        digitalRequired: q.total.toFixed(2),
        cashRequired: "0.00",
      },
    ];
    if (u.role === "STORE" || req.headers.get("X-KT-Workspace") === "STORE") {
      const a = await storeAccess(u.id, "deliveries"),
        rule = q.ruleSnapshot as {
          serviceKey?: string;
          configurationId?: string;
        },
        input = (
          q.metadata as {
            bookingInput?: {
              pickupAddress?: { province?: string };
              dropoffAddress?: { province?: string };
            };
          }
        )?.bookingInput;
      try {
        const b = await resolvePaymentBreakdown({
          storeId: a.store.id,
          orderType: q.deliveryType,
          deliveryServiceId: rule.configurationId,
          deliveryServiceKey: rule.serviceKey,
          provinces: [
            input?.pickupAddress?.province,
            input?.dropoffAddress?.province,
          ].filter((v): v is string => !!v),
          regionId: q.destinationRegionId,
          authoritativeTotal: q.total.toFixed(2),
        });
        if (b.mode !== "DIGITAL_ONLY")
          methods.push({
            mode: b.mode,
            digitalRequired: b.digitalRequired,
            cashRequired: b.cashRequired,
          });
      } catch (e) {
        if (
          !(e instanceof PaymentPolicyError) ||
          ![
            "PAYMENT_POLICY_NOT_CONFIGURED",
            "COD_BUSINESS_NOT_APPROVED",
            "COD_LIMIT_EXCEEDED",
            "PAYMENT_METHOD_NOT_ALLOWED",
          ].includes(e.code)
        )
          throw e;
      }
    }
    return json({ methods });
  } catch (e) {
    return failure(e);
  }
}
