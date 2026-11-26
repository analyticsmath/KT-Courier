import { NextResponse, type NextRequest } from "next/server";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { PaymentError } from "@/lib/payments/errors";
import {
  verifyPaystackSignature,
  verifyPaystackWebhookSecretSignature,
} from "@/lib/payments/providers/paystack/paystack-signature";
import {
  processSandboxAcceptanceWebhook,
  resolveSandboxAcceptanceConfiguration,
} from "@/lib/payments/sandbox-acceptance.service";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  createQaPaystackClient,
  resolveQaAcceptanceLaneConfig,
  resolveQaPaystackWebhookSecrets,
} from "@/lib/qa-acceptance/config";
import { processPaystackWebhook } from "@/lib/services/paystack-webhook-application.service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rateLimitedResponse(status: 429 | 503, message: string, retryAfterSeconds?: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const rate = await checkIpRateLimit(
    request,
    "paystack-sandbox-webhook",
    RATE_LIMITS.PAYMENT_WEBHOOK,
  );
  if (!rate.ok) {
    if (rate.failClosed) {
      return rateLimitedResponse(
        503,
        "Webhook rate limiter is temporarily unavailable.",
        rate.retryAfterSeconds,
      );
    }
    return rateLimitedResponse(429, "Too many webhook requests.", rate.retryAfterSeconds);
  }

  const rawBuffer = new Uint8Array(await request.arrayBuffer());
  if (rawBuffer.byteLength === 0 || rawBuffer.byteLength > 65_536) {
    return noStoreJson({ error: "Invalid webhook payload size." }, 400);
  }

  const signature = request.headers.get("x-paystack-signature");
  const modernSignature = request.headers.get("paystack-signature");
  if (!signature && !modernSignature) {
    return noStoreJson({ error: "Missing Paystack signature header." }, 401);
  }

  const sandboxConfig = resolveSandboxAcceptanceConfiguration();
  const qaConfig = resolveQaAcceptanceLaneConfig();
  if (!sandboxConfig.eligible && !qaConfig.eligible) {
    return noStoreJson({ error: "Sandbox acceptance webhook lane is unavailable." }, 503);
  }

  const r10ValidV1 = Boolean(
    sandboxConfig.eligible &&
      sandboxConfig.webhookSecrets.length > 0 &&
      verifyPaystackWebhookSecretSignature(rawBuffer, modernSignature, sandboxConfig.webhookSecrets),
  );
  const r10ValidHmac = Boolean(
    sandboxConfig.eligible &&
      sandboxConfig.secretKey &&
      verifyPaystackSignature(rawBuffer, signature, sandboxConfig.secretKey),
  );
  const r10Valid = Boolean(r10ValidV1 || r10ValidHmac);

  const qaSecrets = qaConfig.eligible ? resolveQaPaystackWebhookSecrets() : [];
  const qaWhsecSecrets = qaSecrets.filter((secret) => secret.startsWith("whsec_"));
  const qaApiSecrets = qaSecrets.filter((secret) => secret.startsWith("sk_test_"));
  const qaValidV1 = Boolean(
    qaConfig.eligible &&
      modernSignature &&
      qaWhsecSecrets.length > 0 &&
      verifyPaystackWebhookSecretSignature(rawBuffer, modernSignature, qaWhsecSecrets),
  );
  const matchedQaApiSecret =
    (qaConfig.eligible &&
      signature &&
      qaApiSecrets.find((candidate) => verifyPaystackSignature(rawBuffer, signature, candidate))) ||
    null;
  const qaValid = Boolean(
    qaValidV1 || (matchedQaApiSecret && (!modernSignature || qaWhsecSecrets.length === 0)),
  );

  if (!r10Valid && !qaValid) {
    return noStoreJson({ error: "Invalid Paystack signature." }, 401);
  }

  let parsed: unknown;
  try {
    const jsonText = new TextDecoder("utf-8", { fatal: true }).decode(rawBuffer);
    parsed = JSON.parse(jsonText);
  } catch {
    return noStoreJson({ error: "Malformed webhook payload." }, 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return noStoreJson({ error: "Malformed webhook payload." }, 400);
  }
  const eventName =
    "event" in parsed && typeof parsed.event === "string" ? parsed.event.trim() : "";
  const dataObj =
    "data" in parsed &&
    parsed.data &&
    typeof parsed.data === "object" &&
    !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : null;
  if (!eventName || !dataObj) {
    return noStoreJson({ error: "Malformed webhook payload." }, 400);
  }

  const rawRef =
    typeof dataObj.reference === "string"
      ? dataObj.reference
      : typeof dataObj.transaction_reference === "string"
        ? dataObj.transaction_reference
        : "";
  const reference = rawRef.trim() || null;

  if (reference && /^pay_sbox_[a-f0-9]{24}$/.test(reference)) {
    if (!sandboxConfig.eligible) {
      return noStoreJson({ error: "Sandbox acceptance webhook lane is unavailable." }, 503);
    }
    if (!r10Valid) {
      return noStoreJson({ error: "Invalid Paystack signature." }, 401);
    }
    const result = await processSandboxAcceptanceWebhook(rawBuffer, {
      legacyHmac: signature,
      webhookV1: modernSignature,
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
    return noStoreJson({
      received: true,
      status: result.status,
      reference: result.reference,
    });
  }

  if (qaConfig.eligible && reference) {
    const attempt = await prisma.paymentAttempt
      .findUnique({
        where: { merchantReference: reference },
        select: {
          providerEnvironment: true,
          payment: { select: { isQaAcceptance: true } },
        },
      })
      .catch(() => null);

    if (attempt) {
      if (!attempt.payment.isQaAcceptance || attempt.providerEnvironment !== "SANDBOX") {
        return noStoreJson({
          received: true,
          status: "IGNORED_NON_QA_SANDBOX_REFERENCE",
          reference: null,
        });
      }
      if (!qaValid) {
        return noStoreJson({ error: "Invalid Paystack signature." }, 401);
      }
      const qaApiSecret = matchedQaApiSecret ?? qaApiSecrets[0];
      if (!qaApiSecret) {
        return noStoreJson({ error: "QA sandbox webhook credentials are incomplete." }, 503);
      }
      try {
        const webhookResult = await processPaystackWebhook({
          rawBody: Buffer.from(rawBuffer),
          signature,
          modernSignature,
          sourceAddress:
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sandbox-webhook",
          environment: "SANDBOX",
          secretKey: qaApiSecret,
          modernWebhookSecrets: qaWhsecSecrets,
          clientOverride: createQaPaystackClient(),
        });
        return noStoreJson({
          received: true,
          status: webhookResult.outcome,
          eventPublicReference: webhookResult.eventPublicReference,
          reference,
        });
      } catch (error) {
        if (error instanceof PaymentError) {
          if (error.code === "PAYSTACK_SIGNATURE_INVALID") {
            return noStoreJson({ error: "Invalid Paystack signature." }, 401);
          }
          if (
            error.code === "PAYSTACK_CONFIGURATION_INVALID" ||
            error.code === "PAYMENT_METADATA_INVALID"
          ) {
            return noStoreJson({ error: "Malformed webhook payload." }, 400);
          }
        }
        return noStoreJson({ error: "QA sandbox webhook processing failed." }, 503);
      }
    }
  }

  return noStoreJson({
    received: true,
    status: "IGNORED_NON_SANDBOX_ACCEPTANCE_REF",
    reference: null,
  });
}
