import { isIP } from "node:net";
import { PaymentError } from "@/lib/payments/errors";

export type PaymentProxyMode = "direct" | "single_trusted_proxy";
export const PAYFAST_CANONICAL_SOURCE_HEADER = "x-kt-source-ip";

function isPrivateOrSpecial(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a = 0, b = 0] = octets;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || a >= 224;
  }
  const lower = address.toLowerCase();
  return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb");
}

export function normalizePayfastSourceAddress(value: string, allowPrivateForTest = false): string {
  let address = value.trim();
  if (address.startsWith("[") && address.endsWith("]")) address = address.slice(1, -1);
  if (address.includes(",") || /\s/.test(address)) throw new PaymentError("PAYFAST_SOURCE_ADDRESS_INVALID", "Payfast source address is invalid.");
  if (/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.test(address)) address = address.slice(7);
  const version = isIP(address);
  if (version === 0 || (version === 4 && address.includes(":"))) throw new PaymentError("PAYFAST_SOURCE_ADDRESS_INVALID", "Payfast source address is invalid.");
  address = version === 6 ? address.toLowerCase() : address;
  if (!allowPrivateForTest && isPrivateOrSpecial(address)) throw new PaymentError("PAYFAST_SOURCE_ADDRESS_INVALID", "Payfast source address is not public.");
  return address;
}

export function resolvePayfastSourceAddress(input: {
  mode: PaymentProxyMode;
  headers: Headers;
  peerAddress?: string | null;
  allowPrivateForTest?: boolean;
}): string {
  if (input.mode === "direct") {
    if (!input.peerAddress) {
      throw new PaymentError("PAYFAST_SOURCE_ADDRESS_UNAVAILABLE", "The current runtime does not expose the direct peer address.", true);
    }
    return normalizePayfastSourceAddress(input.peerAddress, input.allowPrivateForTest);
  }
  const value = input.headers.get(PAYFAST_CANONICAL_SOURCE_HEADER);
  if (!value) throw new PaymentError("PAYFAST_SOURCE_ADDRESS_UNAVAILABLE", "The trusted proxy source address is unavailable.", true);
  return normalizePayfastSourceAddress(value, input.allowPrivateForTest);
}

export function resolvePaymentProxyMode(value: string | undefined): PaymentProxyMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "direct" || normalized === "single_trusted_proxy") return normalized;
  throw new PaymentError("PAYFAST_SOURCE_ADDRESS_UNAVAILABLE", "Payfast source-address trust is not configured.", true);
}
