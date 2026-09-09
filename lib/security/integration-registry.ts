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

export type ReadinessLockState =
  | "READY"
  | "SOURCE_COMPLETE_FINAL_VALIDATION_PENDING"
  | "CREDENTIAL_PENDING"
  | "INFRASTRUCTURE_PENDING"
  | "PROVIDER_APPROVAL_PENDING"
  | "DISABLED_BY_POLICY"
  | "DEGRADED"
  | "UNAVAILABLE";

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

export interface ReadinessLockRecord {
  id: string;
  category: string;
  state: ReadinessLockState;
  blocksDependentFeature: boolean;
  reasonCode: string;
}

function mapIntegrationReadiness(readiness: IntegrationReadiness): ReadinessLockState {
  switch (readiness) {
    case "LIVE_READY":
    case "SANDBOX_READY":
    case "MOCK_READY":
      return "SOURCE_COMPLETE_FINAL_VALIDATION_PENDING";
    case "CREDENTIAL_PENDING":
      return "CREDENTIAL_PENDING";
    case "ACTIVATION_PENDING":
      return "PROVIDER_APPROVAL_PENDING";
    case "DISABLED":
      return "DISABLED_BY_POLICY";
    case "PARTIAL":
      return "DEGRADED";
    case "NOT_IMPLEMENTED":
      return "UNAVAILABLE";
  }
}

/** The sole operational lock projection for provider capabilities. */
export function getReadinessLockRegistry(): ReadinessLockRecord[] {
  return getIntegrationRegistry().map((integration) => ({
    id: integration.id,
    category: integration.category,
    state: mapIntegrationReadiness(integration.readiness),
    blocksDependentFeature: integration.enabled && !integration.productionEligible,
    reasonCode: integration.readiness,
  }));
}

export function getIntegrationRegistry(): IntegrationRecord[] {
  const isProd = process.env.NODE_ENV === "production";

  // 1. Paystack (Active Payment Gateway)
  const paystackModeRaw = (process.env.PAYSTACK_MODE || "disabled").toLowerCase();
  const paystackHasKey = Boolean(process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes("replace-with"));
  const paystackMode: IntegrationMode =
    paystackModeRaw === "test" ? "sandbox" :
    (paystackModeRaw === "live" || paystackModeRaw === "mock" || paystackModeRaw === "sandbox" || paystackModeRaw === "disabled"
      ? (isProd && paystackModeRaw === "mock" ? "disabled" : paystackModeRaw as IntegrationMode)
      : "disabled");
  const paystackMissing = [
    ...(!paystackHasKey && paystackMode !== "disabled" ? ["PAYSTACK_API_KEY"] : []),
  ];


  let paystackReadiness: IntegrationReadiness = "DISABLED";
  if (paystackMode === "disabled") paystackReadiness = "DISABLED";
  else if (paystackMode === "mock") paystackReadiness = isProd ? "DISABLED" : "MOCK_READY";
  else if (paystackMode === "sandbox") paystackReadiness = paystackHasKey ? "SANDBOX_READY" : "CREDENTIAL_PENDING";
  else if (paystackMode === "live") paystackReadiness = paystackHasKey ? "LIVE_READY" : "CREDENTIAL_PENDING";

  // 1b. PayFast (Retired & Tombstoned)
  const payfastMode: IntegrationMode = "disabled";
  const payfastReadiness: IntegrationReadiness = "DISABLED";
  const payfastMissing: string[] = [];


  // 2. Google Maps Browser
  const mapsBrowserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const mapsBrowserHasKey = Boolean(mapsBrowserKey && !mapsBrowserKey.includes("replace-with"));

  // 3. Google Maps Server
  const mapsServerKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  const mapsServerHasKey = Boolean(mapsServerKey && !mapsServerKey.includes("replace-with"));

  // 4. Resend / Transactional Email
  const emailProvider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailHasKey = Boolean(resendApiKey && !resendApiKey.includes("replace-with"));
  let emailReadiness: IntegrationReadiness = "DISABLED";
  if (emailProvider === "console") {
    emailReadiness = isProd ? "DISABLED" : "MOCK_READY";
  } else if (emailProvider === "resend") {
    emailReadiness = emailHasKey ? "LIVE_READY" : "CREDENTIAL_PENDING";
  }

  // 5. Cloud Object Storage (S3 / R2)
  const storageEndpoint = process.env.PRIVATE_MEDIA_S3_ENDPOINT ?? process.env.STORAGE_ENDPOINT;
  const storageAccessKey = process.env.PRIVATE_MEDIA_S3_ACCESS_KEY_ID ?? process.env.STORAGE_ACCESS_KEY;
  const storageSecretKey = process.env.PRIVATE_MEDIA_S3_SECRET_ACCESS_KEY ?? process.env.STORAGE_SECRET_KEY;
  const storageBucket = process.env.PRIVATE_MEDIA_S3_BUCKET ?? process.env.STORAGE_BUCKET;
  const storageHasKeys = Boolean(
    storageEndpoint &&
    !storageEndpoint.includes("replace-with") &&
    storageAccessKey &&
    !storageAccessKey.includes("replace-with") &&
    storageSecretKey &&
    !storageSecretKey.includes("replace-with") &&
    storageBucket &&
    !storageBucket.includes("replace-with")
  );
  const storageMode = (process.env.PRIVATE_MEDIA_STORAGE || "local").toLowerCase();
  let storageReadiness: IntegrationReadiness = "DISABLED";
  if (storageMode === "s3") {
    storageReadiness = storageHasKeys ? "LIVE_READY" : "CREDENTIAL_PENDING";
  } else if (storageMode === "local") {
    storageReadiness = isProd ? "DISABLED" : "MOCK_READY";
  }

  // 6. Error Monitoring (Sentry)
  const sentryDsn = process.env.SENTRY_DSN;
  const sentryHasKey = Boolean(sentryDsn && !sentryDsn.includes("replace-with"));

  // 7. CAPTCHA / Anti-Abuse (Cloudflare Turnstile)
  const captchaSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const captchaSecretKey = process.env.TURNSTILE_SECRET_KEY ?? process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  const captchaHasKeys = Boolean(
    captchaSiteKey &&
    !captchaSiteKey.includes("replace-with") &&
    captchaSecretKey &&
    !captchaSecretKey.includes("replace-with")
  );

  // 8. Product Analytics
  const analyticsKey = process.env.NEXT_PUBLIC_ANALYTICS_KEY;
  const analyticsHasKey = Boolean(analyticsKey && !analyticsKey.includes("replace-with"));

  // 9. Developer API Authentication & HMAC
  const devHmacKey = process.env.DEVELOPER_API_CREDENTIAL_HMAC_KEY;
  const devApiHasKey = Boolean(devHmacKey && !devHmacKey.includes("replace-with"));

  // 10. Outbound Developer Webhook Dispatch
  const devWebhookKey = process.env.DEVELOPER_WEBHOOK_ENCRYPTION_KEY;
  const devWebhookHasKey = Boolean(devWebhookKey && !devWebhookKey.includes("replace-with"));

  return [
    {
      id: "paystack",
      name: "Paystack Payment Gateway",
      category: "PAYMENT_GATEWAY",
      configuredMode: paystackMode,
      enabled: paystackMode !== "disabled",
      readiness: paystackReadiness,
      missingEnvVars: paystackMissing,
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "VERIFIED_ROUTE_READY",
      safeStatusText: `Mode: ${paystackMode}, Readiness: ${paystackReadiness}`,
      productionEligible: paystackReadiness === "LIVE_READY" || paystackReadiness === "SANDBOX_READY",
    },
    {
      id: "payfast",
      name: "PayFast Custom Checkout (Retired)",
      category: "PAYMENT_GATEWAY",
      configuredMode: payfastMode,
      enabled: false,
      readiness: payfastReadiness,
      missingEnvVars: payfastMissing,
      adapterStatus: "NOT_IMPLEMENTED",
      webhookStatus: "TOMBSTONED_ROUTE_GONE",
      safeStatusText: "Retired and tombstoned (HTTP 410 Gone); Paystack is active",
      productionEligible: false,
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
      id: "object-storage",
      name: "Cloud Object Storage (S3 / R2)",
      category: "STORAGE",
      configuredMode: storageMode === "s3" ? (storageHasKeys ? "live" : "disabled") : (isProd ? "disabled" : "mock"),
      enabled: storageMode === "s3" || (!isProd && storageMode === "local"),
      readiness: storageReadiness,
      missingEnvVars: storageMode === "s3" && !storageHasKeys ? ["PRIVATE_MEDIA_S3_ACCESS_KEY_ID", "PRIVATE_MEDIA_S3_SECRET_ACCESS_KEY", "PRIVATE_MEDIA_S3_BUCKET", "PRIVATE_MEDIA_S3_ENDPOINT"] : [],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: storageHasKeys ? "S3 storage configured" : "Source complete; pending S3/R2 cloud storage credentials",
      productionEligible: storageReadiness === "LIVE_READY",
    },
    {
      id: "error-monitoring",
      name: "Sentry Error & Performance Monitoring",
      category: "OBSERVABILITY",
      configuredMode: sentryHasKey ? "live" : "disabled",
      enabled: sentryHasKey,
      readiness: sentryHasKey ? "LIVE_READY" : "CREDENTIAL_PENDING",
      missingEnvVars: sentryHasKey ? [] : ["SENTRY_DSN"],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: sentryHasKey ? "Configured" : "Source complete; pending SENTRY_DSN",
      productionEligible: sentryHasKey,
    },
    {
      id: "captcha-anti-abuse",
      name: "Cloudflare Turnstile Anti-Abuse",
      category: "SECURITY",
      configuredMode: captchaHasKeys ? "live" : "disabled",
      enabled: captchaHasKeys,
      readiness: captchaHasKeys ? "LIVE_READY" : "CREDENTIAL_PENDING",
      missingEnvVars: captchaHasKeys ? [] : ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_API_KEY"],

      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: captchaHasKeys ? "Turnstile verified & configured" : "Source complete; pending Turnstile keys",
      productionEligible: captchaHasKeys,
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
    {
      id: "analytics",
      name: "Product Analytics",
      category: "OBSERVABILITY",
      configuredMode: analyticsHasKey ? "live" : "disabled",
      enabled: analyticsHasKey,
      readiness: analyticsHasKey ? "LIVE_READY" : "DISABLED",
      missingEnvVars: analyticsHasKey ? [] : ["NEXT_PUBLIC_ANALYTICS_KEY"],
      adapterStatus: "IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: analyticsHasKey ? "Configured" : "Disabled by policy / pending analytics key",
      productionEligible: analyticsHasKey,
    },
    {
      id: "google-identity",
      name: "Google OAuth / Social Login",
      category: "AUTHENTICATION",
      configuredMode: "disabled",
      enabled: false,
      readiness: "DISABLED",
      missingEnvVars: [],
      adapterStatus: "NOT_IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: "Disabled by policy / not launch scope; email & phone auth active",
      productionEligible: false,
    },
    {
      id: "sms-notifications",
      name: "SMS Transactional Messaging",
      category: "COMMUNICATION",
      configuredMode: "disabled",
      enabled: false,
      readiness: "DISABLED",
      missingEnvVars: [],
      adapterStatus: "NOT_IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: "Disabled by policy / not launch scope; email & in-app delivery active",
      productionEligible: false,
    },
    {
      id: "whatsapp-notifications",
      name: "WhatsApp Business Messaging",
      category: "COMMUNICATION",
      configuredMode: "disabled",
      enabled: false,
      readiness: "DISABLED",
      missingEnvVars: [],
      adapterStatus: "NOT_IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: "Disabled by policy / not launch scope",
      productionEligible: false,
    },
    {
      id: "push-notifications",
      name: "Firebase Cloud Messaging Push",
      category: "COMMUNICATION",
      configuredMode: "disabled",
      enabled: false,
      readiness: "DISABLED",
      missingEnvVars: [],
      adapterStatus: "NOT_IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: "Disabled by policy / not launch scope; in-app inbox active",
      productionEligible: false,
    },
    {
      id: "payout-provider",
      name: "Direct Bank Payout / EFT Gateway",
      category: "PAYOUTS",
      configuredMode: "disabled",
      enabled: false,
      readiness: "DISABLED",
      missingEnvVars: [],
      adapterStatus: "NOT_IMPLEMENTED",
      webhookStatus: "NOT_APPLICABLE",
      safeStatusText: "Disabled by policy; dual-control manual admin reconciliation active",
      productionEligible: false,
    },
  ];
}
