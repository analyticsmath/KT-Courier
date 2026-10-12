/** Email links use configured server authority, never the request Host header. */
export function passwordResetUrl(token: string, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const configured = env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || (env.NODE_ENV === "production" ? "https://ktcouriers.com" : "http://localhost:3000");
  const base = new URL(configured);
  if (base.username || base.password || !(base.protocol === "https:" || (base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))) throw new Error("Password reset application origin is invalid.");
  const url = new URL("/reset-password", base);
  url.searchParams.set("token", token);
  return url.toString();
}
