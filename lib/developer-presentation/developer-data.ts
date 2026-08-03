/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma developer models are intentionally accessed through their existing untyped Phase 28 gateway surface; every result is immediately narrowed to a safe presentation projection below. */
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED, DEVELOPER_SCOPE_DESCRIPTIONS, WEBHOOK_EVENT_CATALOG } from "@/lib/developer-api/contracts";
import type { UserRole } from "@/types/db";

type SafeNumberRecord = Readonly<Record<string, number>>;

export type DeveloperOwnerCapabilities = Readonly<{
  canReadDocumentation: boolean;
  canReadApplications: boolean;
  canManageApplications: boolean;
  canSubmitApplications: boolean;
  canReadCredentials: boolean;
  canCreateCredentials: boolean;
  canRotateCredentials: boolean;
  canRevokeCredentials: boolean;
  canReadWebhooks: boolean;
  canManageWebhooks: boolean;
  canReadDeliveries: boolean;
  canRetryDeliveries: boolean;
  canReadUsage: boolean;
}>;

export type DeveloperApplicationRecord = Readonly<{
  id: string;
  reference: string;
  name: string;
  businessPurpose: string;
  environment: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  scopeGrants: readonly DeveloperScopeGrantRecord[];
  termsAcceptedAt: string | null;
  productionLocked: boolean;
}>;

export type DeveloperScopeGrantRecord = Readonly<{
  status: string;
  version: number;
  environment: string;
  scopes: readonly Readonly<{ key: string; description: string | null; state: "approved" | "requested" | "retired" }> [];
}>;

export type DeveloperCredentialRecord = Readonly<{
  id: string;
  reference: string;
  applicationReference: string;
  applicationName: string;
  environment: string;
  prefix: string;
  maskedDisplay: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}>;

export type DeveloperWebhookRecord = Readonly<{
  id: string;
  reference: string;
  applicationReference: string;
  applicationName: string;
  environment: string;
  endpoint: string;
  status: string;
  version: number;
  eventTypes: readonly string[];
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type DeveloperDeliveryRecord = Readonly<{
  id: string;
  reference: string;
  webhookReference: string;
  webhookEndpoint: string;
  eventType: string | null;
  status: string;
  attemptCount: number;
  createdAt: string;
  lastAttemptedAt: string | null;
}>;

export type DeveloperDeliveryAttemptRecord = Readonly<{
  id: string;
  deliveryReference: string;
  attemptNumber: number;
  status: string;
  responseStatus: number | null;
  failureClass: string | null;
  startedAt: string;
  completedAt: string | null;
}>;

export type DeveloperQuotaRecord = Readonly<{
  id: string;
  applicationReference: string;
  applicationName: string;
  period: string;
  startedAt: string;
  counters: SafeNumberRecord;
}>;

export type DeveloperRequestRecord = Readonly<{
  id: string;
  requestId: string;
  applicationReference: string;
  applicationName: string;
  environment: string;
  method: string;
  route: string;
  responseStatus: number;
  createdAt: string;
}>;

export type DeveloperPresentationSnapshot = Readonly<{
  applications: readonly DeveloperApplicationRecord[];
  credentials: readonly DeveloperCredentialRecord[];
  webhooks: readonly DeveloperWebhookRecord[];
  deliveries: readonly DeveloperDeliveryRecord[];
  attempts: readonly DeveloperDeliveryAttemptRecord[];
  quotas: readonly DeveloperQuotaRecord[];
  requests: readonly DeveloperRequestRecord[];
  rateLimitProjectionAvailable: false;
}>;

const database: any = prisma;

const iso = (value: Date | null | undefined): string | null => value ? value.toISOString() : null;
const asSafeNumberRecord = (value: unknown): SafeNumberRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key, entry]) => /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(key) && Number.isInteger(entry) && (entry as number) >= 0 && (entry as number) <= 1_000_000)) as SafeNumberRecord;
};
const asScopeList = (value: unknown): readonly string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry in DEVELOPER_SCOPE_DESCRIPTIONS) : [];
const asEventList = (value: unknown): readonly string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry in WEBHOOK_EVENT_CATALOG) : [];

export async function getDeveloperOwnerCapabilities(args: { userId: string; role: UserRole }): Promise<DeveloperOwnerCapabilities> {
  const effective = new Set(await getEffectivePermissionKeysForUser(args));
  const has = (permission: string) => effective.has(permission);
  return {
    canReadDocumentation: has(PERMISSIONS.DEVELOPER_DOCUMENTATION_READ),
    canReadApplications: has(PERMISSIONS.DEVELOPER_APPLICATION_READ_OWN),
    canManageApplications: has(PERMISSIONS.DEVELOPER_APPLICATION_MANAGE_OWN),
    canSubmitApplications: has(PERMISSIONS.DEVELOPER_APPLICATION_SUBMIT_OWN),
    canReadCredentials: has(PERMISSIONS.DEVELOPER_CREDENTIAL_READ_OWN),
    canCreateCredentials: has(PERMISSIONS.DEVELOPER_CREDENTIAL_CREATE_OWN),
    canRotateCredentials: has(PERMISSIONS.DEVELOPER_CREDENTIAL_ROTATE_OWN),
    canRevokeCredentials: has(PERMISSIONS.DEVELOPER_CREDENTIAL_REVOKE_OWN),
    canReadWebhooks: has(PERMISSIONS.DEVELOPER_WEBHOOK_READ_OWN),
    canManageWebhooks: has(PERMISSIONS.DEVELOPER_WEBHOOK_MANAGE_OWN),
    canReadDeliveries: has(PERMISSIONS.DEVELOPER_WEBHOOK_DELIVERY_READ_OWN),
    canRetryDeliveries: has(PERMISSIONS.DEVELOPER_WEBHOOK_DELIVERY_RETRY_OWN),
    canReadUsage: has(PERMISSIONS.DEVELOPER_API_USAGE_READ_OWN),
  };
}

/**
 * Server-only, owner-scoped presentation projection. It selects only the
 * fields already exposed by the developer session DTOs plus safe association
 * labels needed to join a page. It never reads a credential hash, encrypted
 * endpoint, signing secret, payload, headers, or review evidence.
 */
export async function getDeveloperPresentationSnapshot(userId: string, capabilities: DeveloperOwnerCapabilities): Promise<DeveloperPresentationSnapshot> {
  const applicationsRaw = capabilities.canReadApplications ? await database.developerApplication.findMany({
    where: { ownerUserId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicReference: true, name: true, businessPurpose: true, environment: true, status: true, createdAt: true, updatedAt: true, approvedAt: true },
  }) : [];
  const applicationIds = applicationsRaw.map((application: any) => application.id);
  const applicationById = new Map<string, Readonly<{ publicReference: string; name: string; environment: string }>>(applicationsRaw.map((application: any) => [application.id, { publicReference: application.publicReference, name: application.name, environment: application.environment }]));

  const [scopeGrantsRaw, termsRaw, credentialsRaw, webhooksRaw, quotasRaw, requestsRaw] = await Promise.all([
    capabilities.canReadApplications && applicationIds.length ? database.developerScopeGrant.findMany({ where: { applicationId: { in: applicationIds }, ownerUserId: userId }, orderBy: [{ version: "desc" }, { createdAt: "desc" }], select: { applicationId: true, status: true, version: true, environment: true, scopes: true } }) : [],
    capabilities.canReadApplications && applicationIds.length ? database.developerTermsAcceptance.findMany({ where: { applicationId: { in: applicationIds }, ownerUserId: userId }, orderBy: { acceptedAt: "desc" }, select: { applicationId: true, acceptedAt: true } }) : [],
    capabilities.canReadCredentials && applicationIds.length ? database.developerApiCredential.findMany({ where: { applicationId: { in: applicationIds } }, orderBy: { createdAt: "desc" }, select: { id: true, publicReference: true, applicationId: true, environment: true, prefix: true, maskedDisplay: true, status: true, expiresAt: true, lastUsedAt: true, createdAt: true } }) : [],
    capabilities.canReadWebhooks && applicationIds.length ? database.developerWebhookSubscription.findMany({ where: { applicationId: { in: applicationIds } }, orderBy: { createdAt: "desc" }, select: { id: true, publicReference: true, applicationId: true, environment: true, maskedEndpoint: true, status: true, version: true, eventSelection: true, verifiedAt: true, createdAt: true, updatedAt: true } }) : [],
    capabilities.canReadUsage && applicationIds.length ? database.developerApiQuotaUsage.findMany({ where: { applicationId: { in: applicationIds } }, orderBy: { periodStartedAt: "desc" }, take: 31, select: { id: true, applicationId: true, period: true, periodStartedAt: true, counters: true } }) : [],
    capabilities.canReadUsage && applicationIds.length ? database.developerApiRequestAudit.findMany({ where: { applicationId: { in: applicationIds } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, requestId: true, applicationId: true, environment: true, method: true, route: true, responseStatus: true, createdAt: true } }) : [],
  ]);

  const webhookIds = webhooksRaw.map((webhook: any) => webhook.id);
  const [deliveriesRaw, termsByApplication] = await Promise.all([
    capabilities.canReadDeliveries && webhookIds.length ? database.developerWebhookDelivery.findMany({ where: { subscriptionId: { in: webhookIds } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, publicReference: true, publicEventId: true, subscriptionId: true, status: true, attemptCount: true, createdAt: true, lastAttemptedAt: true } }) : [],
    Promise.resolve(new Map<string, string | null>(termsRaw.map((term: any) => [term.applicationId, iso(term.acceptedAt)]))),
  ]);
  const deliveryIds = deliveriesRaw.map((delivery: any) => delivery.id);
  const eventIds = deliveriesRaw.map((delivery: any) => delivery.publicEventId);
  const [eventsRaw, attemptsRaw] = await Promise.all([
    eventIds.length ? database.developerWebhookPublicEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, eventType: true } }) : [],
    capabilities.canReadDeliveries && deliveryIds.length ? database.developerWebhookAttempt.findMany({ where: { deliveryId: { in: deliveryIds } }, orderBy: [{ startedAt: "desc" }, { attemptNumber: "desc" }], take: 100, select: { id: true, deliveryId: true, attemptNumber: true, status: true, httpStatus: true, failureClass: true, startedAt: true, completedAt: true } }) : [],
  ]);
  const eventTypeById = new Map<string, string>(eventsRaw.map((event: any) => [event.id, event.eventType]));
  const webhooksById = new Map<string, Readonly<{ publicReference: string; maskedEndpoint: string }>>(webhooksRaw.map((webhook: any) => [webhook.id, { publicReference: webhook.publicReference, maskedEndpoint: webhook.maskedEndpoint }]));
  const deliveryReferenceById = new Map<string, string>(deliveriesRaw.map((delivery: any) => [delivery.id, delivery.publicReference]));

  const scopeGrantsByApplication = new Map<string, DeveloperScopeGrantRecord[]>();
  for (const grant of scopeGrantsRaw) {
    const state = grant.status === "ACTIVE" || grant.status === "APPROVED" ? "approved" : grant.status === "RETIRED" ? "retired" : "requested";
    const projected: DeveloperScopeGrantRecord = {
      status: grant.status,
      version: grant.version,
      environment: grant.environment,
      scopes: asScopeList(grant.scopes).map((key) => ({ key, description: DEVELOPER_SCOPE_DESCRIPTIONS[key as keyof typeof DEVELOPER_SCOPE_DESCRIPTIONS] ?? null, state })),
    };
    scopeGrantsByApplication.set(grant.applicationId, [...(scopeGrantsByApplication.get(grant.applicationId) ?? []), projected]);
  }

  return {
    applications: applicationsRaw.map((application: any): DeveloperApplicationRecord => ({
      id: application.id,
      reference: application.publicReference,
      name: application.name,
      businessPurpose: application.businessPurpose,
      environment: application.environment,
      status: application.status,
      createdAt: iso(application.createdAt)!,
      updatedAt: iso(application.updatedAt)!,
      approvedAt: iso(application.approvedAt),
      scopeGrants: scopeGrantsByApplication.get(application.id) ?? [],
      termsAcceptedAt: termsByApplication.get(application.id) ?? null,
      productionLocked: application.environment === "LIVE" && !DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED,
    })),
    credentials: credentialsRaw.flatMap((credential: any): DeveloperCredentialRecord[] => {
      const application = applicationById.get(credential.applicationId);
      return application ? [{ id: credential.id, reference: credential.publicReference, applicationReference: application.publicReference, applicationName: application.name, environment: credential.environment, prefix: credential.prefix, maskedDisplay: credential.maskedDisplay, status: credential.status, expiresAt: iso(credential.expiresAt), lastUsedAt: iso(credential.lastUsedAt), createdAt: iso(credential.createdAt)! }] : [];
    }),
    webhooks: webhooksRaw.flatMap((webhook: any): DeveloperWebhookRecord[] => {
      const application = applicationById.get(webhook.applicationId);
      return application ? [{ id: webhook.id, reference: webhook.publicReference, applicationReference: application.publicReference, applicationName: application.name, environment: webhook.environment, endpoint: webhook.maskedEndpoint, status: webhook.status, version: webhook.version, eventTypes: asEventList(webhook.eventSelection), verifiedAt: iso(webhook.verifiedAt), createdAt: iso(webhook.createdAt)!, updatedAt: iso(webhook.updatedAt)! }] : [];
    }),
    deliveries: deliveriesRaw.flatMap((delivery: any): DeveloperDeliveryRecord[] => {
      const webhook = webhooksById.get(delivery.subscriptionId);
      return webhook ? [{ id: delivery.id, reference: delivery.publicReference, webhookReference: webhook.publicReference, webhookEndpoint: webhook.maskedEndpoint, eventType: eventTypeById.get(delivery.publicEventId) ?? null, status: delivery.status, attemptCount: delivery.attemptCount, createdAt: iso(delivery.createdAt)!, lastAttemptedAt: iso(delivery.lastAttemptedAt) }] : [];
    }),
    attempts: attemptsRaw.flatMap((attempt: any): DeveloperDeliveryAttemptRecord[] => {
      const deliveryReference = deliveryReferenceById.get(attempt.deliveryId);
      return deliveryReference ? [{ id: attempt.id, deliveryReference, attemptNumber: attempt.attemptNumber, status: attempt.status, responseStatus: attempt.httpStatus ?? null, failureClass: attempt.failureClass ?? null, startedAt: iso(attempt.startedAt)!, completedAt: iso(attempt.completedAt) }] : [];
    }),
    quotas: quotasRaw.flatMap((quota: any): DeveloperQuotaRecord[] => {
      const application = applicationById.get(quota.applicationId);
      return application ? [{ id: quota.id, applicationReference: application.publicReference, applicationName: application.name, period: quota.period, startedAt: iso(quota.periodStartedAt)!, counters: asSafeNumberRecord(quota.counters) }] : [];
    }),
    requests: requestsRaw.flatMap((request: any): DeveloperRequestRecord[] => {
      const application = applicationById.get(request.applicationId);
      return application ? [{ id: request.id, requestId: request.requestId, applicationReference: application.publicReference, applicationName: application.name, environment: request.environment ?? application.environment, method: request.method, route: request.route, responseStatus: request.responseStatus, createdAt: iso(request.createdAt)! }] : [];
    }),
    rateLimitProjectionAvailable: false,
  };
}

export function findDeveloperApplication(snapshot: DeveloperPresentationSnapshot, reference: string): DeveloperApplicationRecord | null {
  return snapshot.applications.find((application) => application.reference === reference) ?? null;
}
export function findDeveloperWebhook(snapshot: DeveloperPresentationSnapshot, reference: string): DeveloperWebhookRecord | null {
  return snapshot.webhooks.find((webhook) => webhook.reference === reference) ?? null;
}
export function findDeveloperDelivery(snapshot: DeveloperPresentationSnapshot, reference: string): DeveloperDeliveryRecord | null {
  return snapshot.deliveries.find((delivery) => delivery.reference === reference) ?? null;
}
