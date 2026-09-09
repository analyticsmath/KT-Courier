import { NextRequest } from "next/server";
import { PaymentError } from "@/lib/payments/errors";
import { processPaystackWebhook } from "@/lib/services/paystack-webhook-application.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_048_576; // 1 MB limit

export async function POST(request: NextRequest): Promise<Response> {
  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing x-paystack-signature header." }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  let rawBody: string;
  try {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload exceeds size limit." }), {
        status: 413,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    rawBody = Buffer.from(buffer).toString("utf8");
  } catch {
    return new Response(JSON.stringify({ error: "Could not read request body." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const sourceAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "webhook";

  try {
    const result = await processPaystackWebhook({
      rawBody,
      signature,
      sourceAddress,
    });

    return new Response(JSON.stringify({ received: true, outcome: result.outcome }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      if (error.code === "PAYSTACK_SIGNATURE_INVALID") {
        return new Response(JSON.stringify({ error: "Invalid signature." }), {
          status: 401,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      if (error.retryable) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please retry." }), {
          status: 503,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Webhook processing error." }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
