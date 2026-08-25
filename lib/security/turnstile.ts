export interface TurnstileVerificationResult {
  success: boolean;
  challengeTs?: string;
  hostname?: string;
  errorCodes?: string[];
  action?: string;
  cdata?: string;
}

/**
 * Server-side verification for Cloudflare Turnstile anti-abuse challenge tokens.
 * Fails closed if secret is present but token is invalid or request fails.
 * Fails open/bypassed only when Turnstile is explicitly disabled in non-production.
 */
export async function verifyTurnstileToken(input: {
  token: string;
  remoteIp?: string | null;
  idempotencyKey?: string;
  expectedAction?: string;
}): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY ?? process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;

  if (!secretKey || secretKey.includes("replace-with")) {
    if (process.env.NODE_ENV !== "production") {
      return { success: true };
    }
    return {
      success: false,
      errorCodes: ["TURNSTILE_SECRET_NOT_CONFIGURED"],
    };
  }

  if (!input.token || typeof input.token !== "string" || input.token.trim().length === 0) {
    return {
      success: false,
      errorCodes: ["MISSING_INPUT_RESPONSE"],
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", input.token.trim());
    if (input.remoteIp) formData.append("remoteip", input.remoteIp);
    if (input.idempotencyKey) formData.append("idempotency_key", input.idempotencyKey);

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return {
        success: false,
        errorCodes: [`HTTP_${response.status}`],
      };
    }

    const data = (await response.json()) as {
      success: boolean;
      "challenge_ts"?: string;
      hostname?: string;
      "error-codes"?: string[];
      action?: string;
      cdata?: string;
    };

    if (!data.success) {
      return {
        success: false,
        errorCodes: data["error-codes"] ?? ["CHALLENGE_FAILED"],
      };
    }

    if (input.expectedAction && data.action && data.action !== input.expectedAction) {
      return {
        success: false,
        errorCodes: ["ACTION_MISMATCH"],
      };
    }

    return {
      success: true,
      challengeTs: data["challenge_ts"],
      hostname: data.hostname,
      action: data.action,
      cdata: data.cdata,
    };
  } catch (err) {
    return {
      success: false,
      errorCodes: [err instanceof Error ? err.name : "TURNSTILE_NETWORK_ERROR"],
    };
  }
}
