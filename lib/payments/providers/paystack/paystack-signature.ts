import { createHmac, timingSafeEqual } from "node:crypto";

export function computePaystackHmacSha512(payload: string | Buffer | Uint8Array, secretKey: string): string {
  return createHmac("sha512", secretKey).update(payload).digest("hex");
}

export const calculatePaystackHmac = computePaystackHmacSha512;

export function verifyPaystackSignature(
  rawBody: string | Buffer | Uint8Array,
  signatureHeader: string | null | undefined,
  secretKey: string,
): boolean {
  if (!signatureHeader || !secretKey) {
    return false;
  }
  const cleanSignature = signatureHeader.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(cleanSignature)) {
    return false;
  }
  const expectedSignature = computePaystackHmacSha512(rawBody, secretKey).toLowerCase();
  const signatureBuffer = Buffer.from(cleanSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

/** Verify Paystack's timestamped v1 webhook signature using exact raw bytes.
 * HMAC over t + "." + body, with the dedicated whsec_ signing secret.
 * Multiple v1 signatures support Paystack key rotation without trusting key ids.
 */
export function verifyPaystackWebhookSecretSignature(
  rawBody: string | Buffer | Uint8Array,
  header: string | null | undefined,
  signingSecrets: readonly string[],
  nowUnixSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || header.length > 2500 || !Number.isSafeInteger(nowUnixSeconds)) return false;
  const parts = header.split(",").map(part => part.trim());
  const timestamps = parts.filter(part => part.startsWith("t="));
  if (timestamps.length !== 1 || !/^\d{9,12}$/.test(timestamps[0].slice(2))) return false;
  const timestamp = Number(timestamps[0].slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowUnixSeconds - timestamp) > 300) return false;
  const signatures = parts.filter(part => part.startsWith("v1="));
  if (signatures.length === 0 || signatures.length > 10) return false;
  const secrets = signingSecrets.filter(secret => secret.startsWith("whsec_") && secret.length >= 12 && secret.length <= 512);
  if (!secrets.length) return false;
  const signedBody = Buffer.concat([Buffer.from(String(timestamp) + "."), Buffer.from(rawBody)]);
  let valid = false;
  for (const value of signatures) {
    const colon = value.indexOf(":", 3);
    if (colon < 0) continue;
    const keyId = value.slice(3, colon);
    const signature = value.slice(colon + 1);
    if (!/^whk_[A-Za-z0-9_-]{4,128}$/.test(keyId) || !/^[a-f0-9]{128}$/.test(signature)) continue;
    const actual = Buffer.from(signature, "hex");
    for (const secret of secrets) {
      const expected = createHmac("sha512", secret).update(signedBody).digest();
      if (timingSafeEqual(expected, actual)) valid = true;
    }
  }
  return valid;
}
