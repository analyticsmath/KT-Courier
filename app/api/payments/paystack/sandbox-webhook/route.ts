import { type NextRequest } from "next/server";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { processSandboxAcceptanceWebhook } from "@/lib/payments/sandbox-acceptance.service";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rate = await checkIpRateLimit(request, "paystack-sandbox-webhook", RATE_LIMITS.PAYMENT_WEBHOOK);
  if (!rate.ok) return noStoreJson({ error: "Too many webhook requests." }, 429);

  const rawBuffer = new Uint8Array(await request.arrayBuffer());
  if (rawBuffer.byteLength === 0 || rawBuffer.byteLength > 65_536) {
    return noStoreJson({ error: "Invalid webhook payload size." }, 400);
  }

  const result = await processSandboxAcceptanceWebhook(rawBuffer, {
    legacyHmac: request.headers.get("x-paystack-signature"),
    webhookV1: request.headers.get("paystack-signature"),
  });

  if (result.status === "INVALID_SIGNATURE") {
    return noStoreJson({ error: "Invalid Paystack signature." }, 401);
  }
  if (result.status === "INVALID_PAYLOAD") {
    return noStoreJson({ error: "Malformed webhook payload." }, 400);
  }
  if (!result.accepted && result.status === "LANE_UNAVAILABLE") {
    return noStoreJson({ error: "Sandbox acceptance webhook lane is unavailable." }, 503);
  }
  return noStoreJson({ received: true, status: result.status, reference: result.reference });
}
