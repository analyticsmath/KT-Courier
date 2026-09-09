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
