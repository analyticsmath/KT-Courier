import { NextResponse, type NextRequest } from "next/server";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import {
  processResendWebhook,
  ResendWebhookError,
} from "@/lib/notifications/resend-webhook.service";

export async function POST(req: NextRequest) {
  const rate = await checkIpRateLimit(req, "webhook:resend", {
    max: 300,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const rawBody = await req.text();
  try {
    const outcome = await processResendWebhook({
      rawBody,
      svixId: req.headers.get("svix-id"),
      svixTimestamp: req.headers.get("svix-timestamp"),
      svixSignature: req.headers.get("svix-signature"),
    });
    return NextResponse.json({
      ok: true,
      replayed: outcome.replayed,
      receiptType: outcome.receiptType,
      customerDeliveriesUpdated: outcome.customerDeliveriesUpdated,
      adminAlertsUpdated: outcome.adminAlertsUpdated,
    });
  } catch (err) {
    if (err instanceof ResendWebhookError) {
      return NextResponse.json({ error: err.code }, { status: err.httpStatus });
    }
    return NextResponse.json(
      { error: "WEBHOOK_PROCESSING_FAILED" },
      { status: 500 },
    );
  }
}
