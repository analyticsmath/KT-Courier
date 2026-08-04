export type IntegrationMode = "disabled" | "mock" | "sandbox" | "live";

export type IntegrationReadiness =
  | "NOT_IMPLEMENTED"
  | "PARTIAL"
  | "MOCK_READY"
  | "CREDENTIAL_PENDING"
  | "ACTIVATION_PENDING"
  | "SANDBOX_READY"
  | "LIVE_READY"
  | "DISABLED";

export interface IntegrationRecord {
  id: string;
  name: string;
  category: string;
  configuredMode: IntegrationMode;
  enabled: boolean;
  readiness: IntegrationReadiness;
  missingEnvVars: string[];
  adapterStatus: "IMPLEMENTED" | "PARTIAL" | "NOT_IMPLEMENTED";
  webhookStatus: string;
  safeStatusText: string;
  productionEligible: boolean;
}

export function getIntegrationRegistry(): IntegrationRecord[] {
  const isProd = process.env.NODE_ENV === "production";

  // 1. PayFast
  const payfastModeRaw = (process.env.PAYFAST_MODE || "disabled").toLowerCase() as IntegrationMode;
  const payfastHasKeys = Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY);
  const payfastMode: IntegrationMode = isProd && payfastModeRaw === "mock" ? "disabled" : payfastModeRaw;
  const payfastMissing = [
    ...(!process.env.PAYFAST_MERCHANT_ID ? ["PAYFAST_MERCHANT_ID"] : []),
    ...(!process.env.PAYFAST_MERCHANT_KEY ? ["PAYFAST_MERCHANT_KEY"] : []),
  ];

  let payfastReadiness: IntegrationReadiness = "DISABLED";
  if (payfastMode === "disabled") payfastReadiness = "DISABLED";
  else if (payfastMode === "mock") payfastReadiness = isProd ? "DISABLED" : "MOCK_READY";
  else if (payfastMode === "sandbox") payfastReadiness = payfastHasKeys ? "SANDBOX_READY" : "CREDENTIAL_PENDING";
  else if (payfastMode === "live") payfastReadiness = payfastHasKeys ? "LIVE_READY" : "CREDENTIAL_PENDING";

  // 2. Google Maps Browser
  const mapsBrowserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapsBrowserHasKey = Boolean(mapsBrowserKey && !mapsBrowserKey.includes("replace-with"));

  // 3. Google Maps Server
  const mapsServerKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  const mapsServerHasKey = Boolean(mapsServerKey && !mapsServerKey.includes("replace-with"));

  // 4. Google Identity / OAuth
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleIdentityHasKey = Boolean(googleClientId && !googleClientId.includes("replace-with"));

  // 5. Resend / Email
  const emailProvider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailHasKey = Boolean(resendApiKey && !resendApiKey.includes("replace-with"));
  let emailReadiness: IntegrationReadiness = "DISABLED";
  if (emailProvider === "console") {
    emailReadiness = isProd ? "DISABLED" : "MOCK_READY";
  } else if (emailProvider === "resend") {
    emailReadiness = emailHasKey ? (isProd ? "LIVE_READY" : "SANDBOX_READY") : "CREDENTIAL_PENDING";
  }

  // 6. SMS (SMS Provider / BulkSMS) - Launch Scope Capability
  const smsHasKey = Boolean(process.env.SMS_API_KEY);

  // 7. WhatsApp (Meta / Messaging Gateway) - Launch Scope Capability
  const waHasKey = Boolean(process.env.WHATSAPP_API_KEY);

  // 8. Push Notifications (FCM) - Launch Scope Capability
  const pushHasKey = Boolean(process.env.FIREBASE_SERVER_KEY);

  // 9. Object Storage (S3 / R2)
  const storageHasKey = Boolean(process.env.STORAGE_ACCESS_KEY);

  // 10. Payout Provider (Netcash / Ozow / Bank API)
  const payoutHasKey = Boolean(process.env.PAYOUT_API_KEY);

  // 11. Error Monitoring (Sentry)
  const sentryDsn = process.env.SENTRY_DSN;
  const sentryHasKey = Boolean(sentryDsn && !sentryDsn.includes("replace-with"));

  // 12. Analytics (PostHog / Google Analytics)
  const analyticsKey = process.env.NEXT_PUBLIC_ANALYTICS_KEY;
  const analyticsHasKey = Boolean(analyticsKey && !analyticsKey.includes("replace-with"));

  // 13. CAPTCHA / Anti-Abuse (Cloudflare Turnstile)
  const captchaKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaHasKey = Boolean(captchaKey && !captchaKey.includes("replace-with"));

  // 14. Developer API Authentication
  const devHmacKey = process.env.DEVELOPER_API_CREDENTIAL_HMAC_KEY;
  const devApiHasKey = Boolean(devHmacKey && !devHmacKey.includes("replace-with"));

  // 15. Outbound Developer Webhooks
  const devWebhookKey = process.env.DEVELOPER_WEBHOOK_ENCRYPTION_KEY;
  const devWebhookHasKey = Boolean(devWebhookKey && !devWebhookKey.includes("replace-with"));

  return [
    {
      id: "payfast",
      name: "PayFast Custom Checkout",
      category: "PAYMENT_GATEWAY",
      configuredMode: payfastMode,
      enabled: payfastMode !== "disabled",
      readiness: payfastReadiness,
      missingEnvVars: payfastMissing,
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "VERIFIED_ROUTE_READY",
      safeStatusText: `Mode: ${payfastMode}, Readiness: ${payfastReadiness}`,
      productionEligible: payfastReadiness === "LIVE_READY" || payfastReadiness === "SANDBOX_READY",
    },
    {
      id: "google-maps-browser",
      name: "Google Maps Browser Autocomplete & Geocoding",
      category: "GEOLOCATION",
      configuredMode: mapsBrowserHasKey ? "live" : "disabled",
      enabled: mapsBrowserHasKey,
      readiness: mapsBrowserHasKey ? "LIVE_READY" : "CREDENTIAL_PENDING",
      missingEnvVars: mapsBrowserHasKey ? [] : ["NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: mapsBrowserHasKey ? "Key configured" : "Pending browser API key",
      productionEligible: mapsBrowserHasKey,
    },
    {
      id: "google-maps-server",
      name: "Google Maps Server Routing & Distance Matrix",
      category: "ROUTING",
      configuredMode: mapsServerHasKey ? "live" : "disabled",
      enabled: mapsServerHasKey,
      readiness: mapsServerHasKey ? "LIVE_READY" : "CREDENTIAL_PENDING",
      missingEnvVars: mapsServerHasKey ? [] : ["GOOGLE_MAPS_SERVER_KEY"],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: mapsServerHasKey ? "Key configured" : "Pending server API key",
      productionEligible: mapsServerHasKey,
    },
    {
      id: "google-identity",
      name: "Google OAuth / Social Login",
      category: "AUTHENTICATION",
      configuredMode: googleIdentityHasKey ? "live" : "disabled",
      enabled: googleIdentityHasKey,
      readiness: googleIdentityHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: googleIdentityHasKey ? [] : ["GOOGLE_CLIENT_ID"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: googleIdentityHasKey ? "Configured" : "Pending OAuth Client ID; implementation partial",
      productionEligible: false,
    },
    {
      id: "resend-email",
      name: "Resend / Outbound Transactional Email",
      category: "COMMUNICATION",
      configuredMode: emailProvider === "resend" ? "live" : (emailProvider === "console" ? (isProd ? "disabled" : "mock") : "disabled"),
      enabled: emailProvider !== "disabled",
      readiness: emailReadiness,
      missingEnvVars: emailProvider === "resend" && !emailHasKey ? ["RESEND_API_KEY"] : [],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "VERIFIED_ROUTE_READY",
      safeStatusText: `Provider: ${emailProvider}, Readiness: ${emailReadiness}`,
      productionEligible: emailReadiness === "LIVE_READY",
    },
    {
      id: "sms-notifications",
      name: "SMS Transactional Messaging",
      category: "COMMUNICATION",
      configuredMode: smsHasKey ? "live" : "disabled",
      enabled: smsHasKey,
      readiness: smsHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: smsHasKey ? [] : ["SMS_API_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_IMPLEMENTED",
      safeStatusText: "Registered launch scope; adapter partial, pending provider credentials",
      productionEligible: false,
    },
    {
      id: "whatsapp-notifications",
      name: "WhatsApp Business Messaging",
      category: "COMMUNICATION",
      configuredMode: waHasKey ? "live" : "disabled",
      enabled: waHasKey,
      readiness: waHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: waHasKey ? [] : ["WHATSAPP_API_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_IMPLEMENTED",
      safeStatusText: "Registered launch scope; adapter partial, pending provider credentials",
      productionEligible: false,
    },
    {
      id: "push-notifications",
      name: "Firebase Cloud Messaging Push",
      category: "COMMUNICATION",
      configuredMode: pushHasKey ? "live" : "disabled",
      enabled: pushHasKey,
      readiness: pushHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: pushHasKey ? [] : ["FIREBASE_SERVER_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_IMPLEMENTED",
      safeStatusText: "Registered launch scope; adapter partial, pending Firebase server key",
      productionEligible: false,
    },
    {
      id: "object-storage",
      name: "Cloud Object Storage (S3 / R2)",
      category: "STORAGE",
      configuredMode: storageHasKey ? "live" : "disabled",
      enabled: storageHasKey,
      readiness: storageHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: storageHasKey ? [] : ["STORAGE_ACCESS_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: "Local storage active; adapter partial, pending cloud storage keys",
      productionEligible: false,
    },
    {
      id: "payout-provider",
      name: "Direct Bank Payout / EFT Gateway",
      category: "PAYOUTS",
      configuredMode: payoutHasKey ? "live" : "disabled",
      enabled: payoutHasKey,
      readiness: payoutHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: payoutHasKey ? [] : ["PAYOUT_API_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_IMPLEMENTED",
      safeStatusText: "Dual-control policies active; adapter partial, pending banking gateway API",
      productionEligible: false,
    },
    {
      id: "error-monitoring",
      name: "Sentry Error & Performance Monitoring",
      category: "OBSERVABILITY",
      configuredMode: sentryHasKey ? "live" : "disabled",
      enabled: sentryHasKey,
      readiness: sentryHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: sentryHasKey ? [] : ["SENTRY_DSN"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: sentryHasKey ? "Configured" : "Pending SENTRY_DSN; adapter partial",
      productionEligible: sentryHasKey,
    },
    {
      id: "analytics",
      name: "Product Analytics",
      category: "OBSERVABILITY",
      configuredMode: analyticsHasKey ? "live" : "disabled",
      enabled: analyticsHasKey,
      readiness: analyticsHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: analyticsHasKey ? [] : ["NEXT_PUBLIC_ANALYTICS_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: analyticsHasKey ? "Configured" : "Pending analytics key; adapter partial",
      productionEligible: analyticsHasKey,
    },
    {
      id: "captcha-anti-abuse",
      name: "Cloudflare Turnstile Anti-Abuse",
      category: "SECURITY",
      configuredMode: captchaHasKey ? "live" : "disabled",
      enabled: captchaHasKey,
      readiness: captchaHasKey ? "LIVE_READY" : "PARTIAL",
      missingEnvVars: captchaHasKey ? [] : ["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
      adapterStatus: "PARTIAL",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: captchaHasKey ? "Configured" : "Pending Turnstile site key; adapter partial",
      productionEligible: captchaHasKey,
    },
    {
      id: "developer-api-auth",
      name: "Developer API Authentication & HMAC",
      category: "DEVELOPER_PLATFORM",
      configuredMode: devApiHasKey ? "live" : "sandbox",
      enabled: true,
      readiness: devApiHasKey ? "LIVE_READY" : "SANDBOX_READY",
      missingEnvVars: devApiHasKey ? [] : ["DEVELOPER_API_CREDENTIAL_HMAC_KEY"],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: devApiHasKey ? "HMAC ready" : "Placeholder HMAC key",
      productionEligible: devApiHasKey,
    },
    {
      id: "developer-webhooks",
      name: "Outbound Developer Webhook Dispatch",
      category: "DEVELOPER_PLATFORM",
      configuredMode: devWebhookHasKey ? "live" : "sandbox",
      enabled: true,
      readiness: devWebhookHasKey ? "LIVE_READY" : "SANDBOX_READY",
      missingEnvVars: devWebhookHasKey ? [] : ["DEVELOPER_WEBHOOK_ENCRYPTION_KEY"],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "DISPATCH_ENGINE_READY",
      safeStatusText: devWebhookHasKey ? "Webhook encryption ready" : "Placeholder encryption key",
      productionEligible: devWebhookHasKey,
    },
  ];
}
