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
    let cod: { eligible: boolean; amountDueAtDelivery: string; reasonCode?: string; message?: string } = {
      eligible: false,
      amountDueAtDelivery: q.total.toFixed(2),
      reasonCode: "NOT_ENABLED",
      message: "Cash on delivery is not currently enabled for this delivery and area.",
    };
    if (["CUSTOMER", "STORE"].includes(u.role)) {
      const business = u.role === "STORE" || req.headers.get("X-KT-Workspace") === "STORE";
      const store = business ? (await storeAccess(u.id, "deliveries")).store : null;
      const rule = q.ruleSnapshot as {
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
          storeId: store?.id ?? null,
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
        if (b.mode === "FULL_COD") {
          methods.push({
            mode: b.mode,
            digitalRequired: b.digitalRequired,
            cashRequired: b.cashRequired,
          });
          cod = { eligible: true, amountDueAtDelivery: b.cashRequired };
        }
      } catch (e) {
        if (!(e instanceof PaymentPolicyError)) throw e;
        if (e.code === "COD_LIMIT_EXCEEDED") {
          cod = { ...cod, reasonCode: "LIMIT_EXCEEDED", message: "This delivery exceeds the current cash payment limit." };
        } else if (["COD_PRODUCTION_APPROVAL_REQUIRED", "COD_REMITTANCE_NOT_CONFIGURED"].includes(e.code)) {
          cod = { ...cod, reasonCode: "APPROVAL_PENDING", message: "Cash on delivery is awaiting the required operational approval." };
        } else if (!["PAYMENT_POLICY_NOT_CONFIGURED", "COD_BUSINESS_NOT_APPROVED", "PAYMENT_METHOD_NOT_ALLOWED"].includes(e.code)) {
          throw e;
        }
      }
    }
    return json({ methods, cod });
  } catch (e) {
    return failure(e);
  }
}
