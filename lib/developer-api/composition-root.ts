/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import type { ActivationDbClient } from "@/lib/governance/module-activation";
import { createPrismaDeveloperApiRepositories } from "./repositories";
import { CredentialService, DbQuotaService, DbRateLimitService, DeveloperTermsService, IdempotencyService, ScopeGrantService, WebhookExecutionService, WebhookSubscriptionService } from "./services";
import { DeveloperWebhookProjectionService, DeveloperWebhookSourceEventService } from "./webhook-projection";
import { DeveloperApiMaintenanceService, Phase28ProcessorService } from "./processor-service";
import { DEVELOPER_API_PRODUCTION_LOCK_REASON, assertDeveloperApiProductionReady } from "./production-readiness";
import type { EnvSource } from "./activation";

export const DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER = [
  "concrete Prisma developer repositories", "canonical User authority", "canonical Store authority", "canonical Customer authority", "cryptographic random authority", "credential keyed-hash authority", "credential verification service", "scope-grant authority", "terms-acceptance authority", "rate-limit service", "quota service", "idempotency service", "public resource adapters", "public DTO mappers", "public request-audit authority", "OpenAPI contract authority", "canonical source-event adapters", "webhook public-projection adapters", "endpoint DNS and SSRF validator", "endpoint verification service", "encryption authority", "HTTP message-signature service", "webhook delivery service", "retry service", "reconciliation service", "canonical audit authority", "readiness assertion",
] as const;

function buildDeveloperApiServices(database: any) {
  const repositories = createPrismaDeveloperApiRepositories(database);
  const terms = new DeveloperTermsService(database);
  const scopeGrants = new ScopeGrantService(database);
  const credentialService = new CredentialService(database, terms);
  const rateLimits = new DbRateLimitService(database);
  const quotas = new DbQuotaService(database);
  const idempotency = new IdempotencyService(database);
  const webhooks = new WebhookSubscriptionService(database);
  const sourceEvents = new DeveloperWebhookSourceEventService(database);
  const projections = new DeveloperWebhookProjectionService(database, sourceEvents);
  const execution = new WebhookExecutionService(database, webhooks);
  const maintenance = new DeveloperApiMaintenanceService(database);
  const processors = new Phase28ProcessorService(database, maintenance, webhooks, execution, projections, sourceEvents);
  const services = Object.freeze({ terms, scopeGrants, credentialService, rateLimits, quotas, idempotency, webhooks, sourceEvents, projections, execution, maintenance, processors });
  return { repositories, services };
}

export async function resolveDeveloperApiProductionCompositionAsync(
  options: Readonly<{ db?: ActivationDbClient; env?: EnvSource; now?: Date }> = {},
) {
  const database: any = options.db ?? prisma;
  const { repositories, services } = buildDeveloperApiServices(database);
  try {
    await assertDeveloperApiProductionReady({ db: database, env: options.env, now: options.now });
    return Object.freeze({ status: "READY" as const, database, repositories, services });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : DEVELOPER_API_PRODUCTION_LOCK_REASON;
    return Object.freeze({ status: "LOCKED" as const, code, database, repositories, services });
  }
}

/** Fail-closed synchronous composition snapshot when async DB governance has not been resolved. */
export function resolveDeveloperApiProductionComposition() {
  const database: any = prisma;
  const { repositories, services } = buildDeveloperApiServices(database);
  return Object.freeze({ status: "LOCKED" as const, code: DEVELOPER_API_PRODUCTION_LOCK_REASON, database, repositories, services });
}
