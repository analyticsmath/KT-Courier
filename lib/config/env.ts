// Server-only. Do NOT import this into Client Components.

export type EmailProviderMode = "resend" | "console";

export interface RuntimeConfigStatus {
  database: boolean;
  emailProvider: EmailProviderMode;
  emailFromConfigured: boolean;
  emailReplyToConfigured: boolean;
  appUrlConfigured: boolean;
  isProduction: boolean;
  // Google Maps (Phase 2.1)
  mapsEnabled: boolean;
  mapsBrowserKeyConfigured: boolean;
  mapsServerKeyConfigured: boolean;
  warnings: string[];
  productionReady: boolean;
}

export function getRuntimeConfigStatus(): RuntimeConfigStatus {
  const isProduction = process.env.NODE_ENV === "production";
  const database = !!process.env.DATABASE_URL;
  const resendApiKey = !!process.env.RESEND_API_KEY;
  const emailFrom = !!process.env.EMAIL_FROM;
  const emailReplyTo = !!process.env.EMAIL_REPLY_TO;
  const appUrl = !!process.env.NEXT_PUBLIC_APP_URL;
  const explicitConsole = process.env.EMAIL_PROVIDER === "console";
  const mapsBrowserKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapsServerKey = !!process.env.GOOGLE_MAPS_SERVER_KEY;

  const emailProvider: EmailProviderMode =
    resendApiKey && !explicitConsole ? "resend" : "console";

  const mapsEnabled = mapsBrowserKey || mapsServerKey;

  const warnings: string[] = [];

  if (!database) {
    warnings.push("DATABASE_URL is not configured. The application cannot connect to the database.");
  }
  if (isProduction && emailProvider === "console") {
    warnings.push(
      "RESEND_API_KEY is not configured. Emails will not be delivered in production. EmailLog records will be marked FAILED."
    );
  }
  if (isProduction && !emailFrom) {
    warnings.push(
      "EMAIL_FROM is not configured. Emails will use the default fallback address (noreply@ktcouriers.co.za)."
    );
  }
  if (!appUrl) {
    warnings.push(
      "NEXT_PUBLIC_APP_URL is not configured. Password reset links will use a fallback base URL."
    );
  }
  if (isProduction && !emailReplyTo) {
    warnings.push(
      "EMAIL_REPLY_TO is not configured. Admin contact notifications will use EMAIL_FROM as fallback."
    );
  }
  if (!mapsBrowserKey) {
    warnings.push(
      "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not configured. Address autocomplete will use manual input fallback."
    );
  }
  if (!mapsServerKey) {
    warnings.push(
      "GOOGLE_MAPS_SERVER_KEY is not configured. Server-side route calculation will be unavailable."
    );
  }

  const productionReady =
    database &&
    (!isProduction || emailProvider === "resend") &&
    appUrl;

  return {
    database,
    emailProvider,
    emailFromConfigured: emailFrom,
    emailReplyToConfigured: emailReplyTo,
    appUrlConfigured: appUrl,
    isProduction,
    mapsEnabled,
    mapsBrowserKeyConfigured: mapsBrowserKey,
    mapsServerKeyConfigured: mapsServerKey,
    warnings,
    productionReady,
  };
}

// ─── Maps server key (server-side only — never expose to client) ──────────────

export function getGoogleMapsServerKey(): string | null {
  return process.env.GOOGLE_MAPS_SERVER_KEY ?? null;
}

export function getGoogleMapsRegionBias(): string {
  return process.env.GOOGLE_MAPS_REGION_BIAS ?? "ZA";
}

// ─── Required env var assertions (call once at startup in server code) ─────────

export function assertRequiredEnv(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[KT ENV] DATABASE_URL is required. Application cannot start without a database connection."
    );
  }
}
