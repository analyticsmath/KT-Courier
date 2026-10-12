import { createHash } from "node:crypto";

const protectedHosts = new Set(["ktcouriers.com", "www.ktcouriers.com", "web-production-9f8bb.up.railway.app"]);
const protectedIds = new Set(["e9554aaa-1b53-4595-8731-e8c2885ac594", "2226be2a-86f7-4590-a7b4-72aa54dccf52", "prj_Q6i3g8JIv1ibkXGspPotBem2FFLD"]);
const sha256 = value => createHash("sha256").update(value).digest("hex");
const productionMarker = value => /(?:^|[._/-])(?:production|prod|live)(?:$|[._/-])/i.test(value);
const credentialName = name => /SECRET|TOKEN|PASSWORD|(?:^|_)KEY(?:$|_)|DATABASE_URL|DIRECT_URL|REDIS_URL/.test(name);

/** No dotenv loading, network requests, credential logging or resource mutations. */
export function assertStagingIsolation(env, policy) {
  const failures = new Set();
  const fail = field => failures.add(field);
  const approval = policy?.approval;
  if (!approval?.owner || !approval.evidenceRef || !approval.currency || !Number.isFinite(approval.maxSpend) ||
      approval.maxSpend < 0 || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.now()) fail("approval");
  if (!policy?.protectedInventoryRef || !Array.isArray(policy.protectedSecretFingerprints) || !Array.isArray(policy.protectedResourceIds)) fail("protected-inventory");
  if (env.KT_DATABASE_CLASSIFICATION !== "staging" || env.KT_RUNTIME_ENV !== "staging-demo") fail("runtime-classification");
  if (env.KT_NETWORK_DISABLED !== "true" || env.EMAIL_PROVIDER !== "console" || env.PAYSTACK_ACTIVE !== "false" ||
      ![undefined, "disabled"].includes(env.PAYSTACK_MODE) || ![undefined, "disabled"].includes(env.PAYFAST_MODE) ||
      env.WITHDRAWAL_PAYOUT_ENABLED !== "false") fail("offline-provider-locks");
  if (env.COOKIE_DOMAIN || env.RESEND_API_KEY || env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_KEY ||
      env.PAYSTACK_SECRET_KEY || env.PAYSTACK_PUBLIC_KEY || env.GOOGLE_MAPS_SERVER_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) fail("external-provider-credentials");
  if (env.RAILWAY_PROJECT_ID !== policy?.railwayProjectId || !env.RAILWAY_PROJECT_ID ||
      env.RAILWAY_ENVIRONMENT_ID !== policy?.railwayEnvironmentId || !env.RAILWAY_ENVIRONMENT_ID ||
      policy?.protectedResourceIds?.includes(env.RAILWAY_PROJECT_ID) || policy?.protectedResourceIds?.includes(env.RAILWAY_ENVIRONMENT_ID)) fail("railway-identity");
  if (!Array.isArray(policy?.workerCommands) || !policy.workerCommands.includes(env.KT_STAGING_WORKER_COMMAND)) fail("worker-command");

  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    if (/^sk_live_|^pk_live_/.test(value)) fail(name);
    if (protectedIds.has(value) || policy?.protectedResourceIds?.includes(value)) fail(name);
    if (credentialName(name)) {
      const fingerprint = sha256(value);
      if (policy?.protectedSecretFingerprints?.includes(fingerprint) || policy?.secretFingerprints?.[name] !== fingerprint) fail(name);
    }
    if (/URL$|ORIGIN$|ENDPOINT$/.test(name) || name === "ALLOWED_ORIGINS") {
      for (const raw of value.split(",")) {
        try {
          const url = new URL(raw.trim());
          if (protectedHosts.has(url.hostname) || url.hostname.endsWith(".ktcouriers.com") || productionMarker(url.hostname) ||
              !policy?.allowedHosts?.includes(url.hostname)) fail(name);
          if (["DATABASE_URL", "DIRECT_URL", "SHADOW_DATABASE_URL"].includes(name)) {
            if (!["postgresql:", "postgres:"].includes(url.protocol) || url.pathname.slice(1) !== policy?.databaseName || productionMarker(url.pathname)) fail(name);
          } else if (name === "REDIS_URL") {
            if (!["redis:", "rediss:"].includes(url.protocol) || url.pathname !== `/${policy?.redisDatabase}` || !env.KT_QUEUE_NAMESPACE || env.KT_QUEUE_NAMESPACE !== policy?.queueNamespace) fail(name);
          } else if (url.protocol !== "https:" || url.username || url.password) fail(name);
        } catch { fail(name); }
      }
    }
    if (/BUCKET$|CLOUD_NAME$|PREFIX$/.test(name) && (productionMarker(value) || !policy?.storageResources?.includes(value))) fail(name);
  }
  for (const name of ["DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_APP_URL", "PAYMENT_APP_ORIGIN", "ALLOWED_ORIGINS", "PRIVATE_MEDIA_STORAGE", "CATALOG_MEDIA_STORAGE", "REPORT_ARTIFACT_STORAGE"]) if (!env[name]) fail(name);
  for (const [name, provider] of [["PRIVATE_MEDIA_STORAGE", "local"], ["CATALOG_MEDIA_STORAGE", "filesystem"], ["REPORT_ARTIFACT_STORAGE", "local"]]) if (env[name] !== provider) fail(name);
  if (!policy?.allowedHosts?.length || !policy.databaseName || !Number.isInteger(policy.redisDatabase) || policy.redisDatabase < 0 || !policy.queueNamespace || productionMarker(policy.queueNamespace)) fail("resource-policy");
  if (failures.size) throw new Error(`STAGING_ISOLATION_REFUSED: ${[...failures].sort().join(", ")}`);
  return { status: "PASS", providerMode: "offline", railwayProjectId: policy.railwayProjectId, railwayEnvironmentId: policy.railwayEnvironmentId, approvalRef: approval.evidenceRef, checkedVariableNames: Object.keys(env).sort() };
}
