/** Browser-safe same-origin navigation after successful authentication. */
export function safeAuthReturnUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value || value.length > 2048) return undefined;
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(path)
  )
    return undefined;
  try {
    const url = new URL(path, "https://kt.internal");
    if (
      url.origin !== "https://kt.internal" ||
      /%(?:2f|5c)/i.test(url.pathname)
    )
      return undefined;
    return url.pathname + url.search + url.hash;
  } catch {
    return undefined;
  }
}
export function verificationReturnUrl(
  email: string,
  returnUrl?: string,
  deliveryPending = false,
) {
  const params = new URLSearchParams({ email });
  const safe = safeAuthReturnUrl(returnUrl);
  if (safe) params.set("returnUrl", safe);
  if (deliveryPending) params.set("delivery", "pending");
  return `/verify-otp?${params}`;
}
