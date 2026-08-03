import { PaymentError } from "./errors";

const MAX_REDIRECT_LENGTH = 2_048;

export function validateProviderRedirectUrl(
  candidate: string,
  allowedHosts: readonly string[],
  options?: { allowHttpForInjectedTest?: boolean },
): string {
  if (!candidate || candidate.length > MAX_REDIRECT_LENGTH) {
    throw new PaymentError("PAYMENT_PROVIDER_REDIRECT_INVALID", "Provider redirect URL is missing or too long.");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new PaymentError("PAYMENT_PROVIDER_REDIRECT_INVALID", "Provider redirect URL is invalid.");
  }

  const validProtocol = url.protocol === "https:"
    || (options?.allowHttpForInjectedTest === true && url.protocol === "http:");
  const normalizedHosts = new Set(allowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean));
  if (!validProtocol || !normalizedHosts.has(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new PaymentError("PAYMENT_PROVIDER_REDIRECT_INVALID", "Provider redirect URL failed the safety policy.");
  }
  return url.toString();
}

