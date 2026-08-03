/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 27 is intentionally insulated from deferred Prisma generation. */
import { createHash } from "node:crypto";
import { NotificationPolicyError, assertSafeActionRoute, deliveryEligible, nextRetryAt, type NotificationChannel, type NotificationPurpose, type NotificationSensitivity } from "./contracts";
import { renderNotificationTemplate, type TemplateVariable } from "./template-renderer";
import { assertNotificationProductionReady } from "./production-readiness";
import { KNOWN_NOTIFICATION_SOURCE_AUTHORITIES } from "./event-registry";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const reference = (prefix: string, value: string) => `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
const now = () => new Date();
const NOTIFICATION_PURPOSES: NotificationPurpose[] = ["SECURITY", "LEGAL", "TRANSACTIONAL", "OPERATIONAL", "SERVICE_ANNOUNCEMENT", "MARKETING"];
const NOTIFICATION_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const NOTIFICATION_SENSITIVITIES: NotificationSensitivity[] = ["PUBLIC", "ACCOUNT", "FINANCIAL", "SECURITY", "RESTRICTED"];

export const RECIPIENT_SUBJECTS = [
  "EVENT_ACTOR", "CUSTOMER", "STORE_OWNER", "AUTHORIZED_STORE_STAFF", "ASSIGNED_DRIVER", "PROMOTER",
  "RECRUITMENT_APPLICANT", "ASSIGNED_RECRUITER", "ASSIGNED_HIRING_MANAGER", "FINANCE_ADMINISTRATOR",
  "RECONCILIATION_ADMINISTRATOR", "SECURITY_ADMINISTRATOR",
] as const;
export type RecipientSubject = (typeof RECIPIENT_SUBJECTS)[number];
export const RECONCILIATION_ACTIONS = ["rescan", "retry-source-intake", "retry-fan-out", "retry-delivery", "refresh-provider-receipt", "deactivate-invalid-endpoint", "rebuild-digest"] as const;
export type ReconciliationAction = (typeof RECONCILIATION_ACTIONS)[number];

function ensureNonEmpty(value: string, code: string) {
  if (!value || value.length > 160) throw new NotificationPolicyError(code);
}

/** Categories are created with their policy frozen. The approved repository lifecycle is ACTIVE → RETIRED. */
export class NotificationCategoryService {
  constructor(private readonly db: any) {}

  async list() { return this.db.notificationCategory.findMany({ orderBy: { key: "asc" } }); }

  async create(input: { key: string; purpose: NotificationPurpose; defaultPriority: string; defaultSensitivity: NotificationSensitivity; mandatory: boolean; preferenceControlled: boolean; consentRequired: boolean; quietHoursBypass: boolean; digestEligible: boolean; retentionPolicyReference?: string | null }) {
    ensureNonEmpty(input.key, "INVALID_NOTIFICATION_CATEGORY");
    if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(input.key)) throw new NotificationPolicyError("INVALID_NOTIFICATION_CATEGORY");
    if (!NOTIFICATION_PURPOSES.includes(input.purpose) || !NOTIFICATION_PRIORITIES.includes(input.defaultPriority as (typeof NOTIFICATION_PRIORITIES)[number]) || !NOTIFICATION_SENSITIVITIES.includes(input.defaultSensitivity)) throw new NotificationPolicyError("INVALID_NOTIFICATION_CATEGORY");
    if ((input.purpose === "SECURITY" || input.purpose === "LEGAL") && (!input.mandatory || input.preferenceControlled)) throw new NotificationPolicyError("MANDATORY_NOTIFICATION_CATEGORY_REQUIRED");
    if (input.purpose === "MARKETING" && !input.consentRequired) throw new NotificationPolicyError("MARKETING_CONSENT_REQUIRED");
    if (input.digestEligible && (input.mandatory || input.defaultPriority === "URGENT" || input.purpose === "SECURITY")) throw new NotificationPolicyError("INVALID_NOTIFICATION_DIGEST_CATEGORY");
    return this.db.notificationCategory.create({ data: { publicReference: reference("ncat", input.key), ...input, status: "ACTIVE" } });
  }

  async retire(categoryReference: string) {
    const category = await this.db.notificationCategory.findUnique({ where: { publicReference: categoryReference } });
    if (!category) throw new NotificationPolicyError("NOTIFICATION_CATEGORY_NOT_FOUND");
    if (category.status === "RETIRED") return category;
    return this.db.notificationCategory.update({ where: { id: category.id }, data: { status: "RETIRED" } });
  }
}

export class NotificationTemplateService {
  constructor(private readonly db: any) {}

  async list() { return this.db.notificationTemplate.findMany({ orderBy: { key: "asc" } }); }

  async create(input: { key: string; categoryKey: string }) {
    ensureNonEmpty(input.key, "INVALID_NOTIFICATION_TEMPLATE");
    const category = await this.db.notificationCategory.findUnique({ where: { key: input.categoryKey } });
    if (!category || category.status !== "ACTIVE") throw new NotificationPolicyError("NOTIFICATION_CATEGORY_NOT_ACTIVE");
    return this.db.notificationTemplate.create({ data: { publicReference: reference("ntpl", input.key), ...input } });
  }

  async get(referenceValue: string) {
    const template = await this.db.notificationTemplate.findUnique({ where: { publicReference: referenceValue } });
    if (!template) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_NOT_FOUND");
    const versions = await this.db.notificationTemplateVersion.findMany({ where: { templateId: template.id }, orderBy: { versionNumber: "desc" } });
    return { template, versions };
  }

  async update(referenceValue: string, input: { categoryKey: string }) {
    const template = await this.db.notificationTemplate.findUnique({ where: { publicReference: referenceValue } });
    if (!template) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_NOT_FOUND");
    const published = await this.db.notificationTemplateVersion.findFirst({ where: { templateId: template.id, status: "PUBLISHED" } });
    if (published) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_IMMUTABLE");
    const category = await this.db.notificationCategory.findUnique({ where: { key: input.categoryKey } });
    if (!category || category.status !== "ACTIVE") throw new NotificationPolicyError("NOTIFICATION_CATEGORY_NOT_ACTIVE");
    return this.db.notificationTemplate.update({ where: { id: template.id }, data: { categoryKey: input.categoryKey } });
  }

  async createVersion(templateReference: string, input: { locale?: string; purpose: NotificationPurpose; sensitivity: NotificationSensitivity; subjectTemplate?: string | null; titleTemplate?: string | null; plainTextTemplate?: string | null; htmlTemplate?: string | null; pushTemplate?: string | null; smsTemplate?: string | null; actionLabel?: string | null; actionRoute?: string | null; expiryMinutes?: number | null; variables: TemplateVariable[] }) {
    const template = await this.db.notificationTemplate.findUnique({ where: { publicReference: templateReference } });
    if (!template) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_NOT_FOUND");
    const category = await this.db.notificationCategory.findUnique({ where: { key: template.categoryKey } });
    if (!category || category.status !== "ACTIVE" || input.purpose !== category.purpose || input.sensitivity !== category.defaultSensitivity) throw new NotificationPolicyError("INVALID_NOTIFICATION_TEMPLATE_POLICY");
    assertSafeActionRoute(input.actionRoute ?? undefined);
    if (!input.plainTextTemplate && !input.titleTemplate && !input.pushTemplate && !input.smsTemplate) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_CONTENT_REQUIRED");
    const latest = await this.db.notificationTemplateVersion.findFirst({ where: { templateId: template.id }, orderBy: { versionNumber: "desc" } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const version = await this.db.notificationTemplateVersion.create({ data: { publicReference: reference("ntv", `${template.id}:${versionNumber}`), templateId: template.id, versionNumber, status: "DRAFT", locale: input.locale ?? "en-ZA", purpose: input.purpose, sensitivity: input.sensitivity, subjectTemplate: input.subjectTemplate ?? null, titleTemplate: input.titleTemplate ?? null, plainTextTemplate: input.plainTextTemplate ?? null, htmlTemplate: input.htmlTemplate ?? null, pushTemplate: input.pushTemplate ?? null, smsTemplate: input.smsTemplate ?? null, actionLabel: input.actionLabel ?? null, actionRoute: input.actionRoute ?? null, expiryMinutes: input.expiryMinutes ?? null } });
    if (input.variables.length) await this.db.notificationTemplateVariable.createMany({ data: input.variables.map((variable) => ({ templateVersionId: version.id, ...variable })) });
    return version;
  }

  async submit(referenceValue: string) { return this.transition(referenceValue, "DRAFT", "UNDER_REVIEW"); }
  async approve(referenceValue: string, actorUserId: string) { return this.transition(referenceValue, "UNDER_REVIEW", "APPROVED", { approvedByUserId: actorUserId, approvedAt: now() }); }
  async publish(referenceValue: string, actorUserId: string) {
    const version = await this.db.notificationTemplateVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!version) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_VERSION_NOT_FOUND");
    if (version.status !== "APPROVED") throw new NotificationPolicyError("INVALID_NOTIFICATION_TEMPLATE_TRANSITION");
    if (version.approvedByUserId === actorUserId) throw new NotificationPolicyError("TEMPLATE_APPROVAL_SEPARATION_REQUIRED");
    return this.db.notificationTemplateVersion.update({ where: { id: version.id }, data: { status: "PUBLISHED", publishedAt: now(), publicationEvidence: { approvedByUserId: version.approvedByUserId, publisherUserId: actorUserId } } });
  }
  async retire(referenceValue: string) {
    const version = await this.db.notificationTemplateVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!version) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_VERSION_NOT_FOUND");
    if (version.status === "RETIRED") return version;
    if (version.status === "DRAFT") throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_NOT_SUBMITTED");
    return this.db.notificationTemplateVersion.update({ where: { id: version.id }, data: { status: "RETIRED", retiredAt: now() } });
  }

  async render(input: { templateVersionId: string; channel: NotificationChannel; values: Record<string, unknown> }) {
    const version = await this.db.notificationTemplateVersion.findUnique({ where: { id: input.templateVersionId } });
    if (!version || version.status !== "PUBLISHED") throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_VERSION_NOT_PUBLISHED");
    const variables = await this.db.notificationTemplateVariable.findMany({ where: { templateVersionId: version.id } });
    const template = input.channel === "SMS" ? version.smsTemplate : input.channel === "WEB_PUSH" || input.channel === "ANDROID_PUSH" ? version.pushTemplate : input.channel === "IN_APP" ? (version.titleTemplate ?? version.plainTextTemplate) : (version.plainTextTemplate ?? version.subjectTemplate);
    if (!template) throw new NotificationPolicyError("NOTIFICATION_CHANNEL_TEMPLATE_NOT_CONFIGURED");
    const body = renderNotificationTemplate({ template, variables, values: input.values, channel: input.channel, sensitivity: version.sensitivity, html: false, actionRoute: version.actionRoute ?? undefined });
    return { version, body, actionRoute: version.actionRoute ?? null };
  }

  private async transition(referenceValue: string, from: string, to: string, data: Record<string, unknown> = {}) {
    const version = await this.db.notificationTemplateVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!version) throw new NotificationPolicyError("NOTIFICATION_TEMPLATE_VERSION_NOT_FOUND");
    if (version.status !== from) throw new NotificationPolicyError("INVALID_NOTIFICATION_TEMPLATE_TRANSITION");
    return this.db.notificationTemplateVersion.update({ where: { id: version.id }, data: { status: to, ...data } });
  }
}

export class NotificationRouteService {
  constructor(private readonly db: any) {}
  async list() { return this.db.notificationEventRoute.findMany({ orderBy: [{ sourceAuthority: "asc" }, { sourceEventType: "asc" }] }); }
  async create(input: { key: string; sourceAuthority: string; sourceEventType: string }) {
    ensureNonEmpty(input.key, "INVALID_NOTIFICATION_ROUTE"); ensureNonEmpty(input.sourceAuthority, "INVALID_NOTIFICATION_ROUTE"); ensureNonEmpty(input.sourceEventType, "INVALID_NOTIFICATION_ROUTE");
    return this.db.notificationEventRoute.create({ data: { publicReference: reference("nroute", `${input.sourceAuthority}:${input.sourceEventType}`), ...input } });
  }
  async get(referenceValue: string) {
    const route = await this.db.notificationEventRoute.findUnique({ where: { publicReference: referenceValue } });
    if (!route) throw new NotificationPolicyError("NOTIFICATION_ROUTE_NOT_FOUND");
    const versions = await this.db.notificationEventRouteVersion.findMany({ where: { routeId: route.id }, orderBy: { versionNumber: "desc" } });
    return { route, versions };
  }
  async update(referenceValue: string, input: { key?: string; sourceAuthority?: string; sourceEventType?: string }) {
    const route = await this.db.notificationEventRoute.findUnique({ where: { publicReference: referenceValue } });
    if (!route) throw new NotificationPolicyError("NOTIFICATION_ROUTE_NOT_FOUND");
    const active = await this.db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id, status: "ACTIVE" } });
    if (active) throw new NotificationPolicyError("NOTIFICATION_ROUTE_IMMUTABLE");
    if (input.sourceAuthority) ensureNonEmpty(input.sourceAuthority, "INVALID_NOTIFICATION_ROUTE");
    if (input.sourceEventType) ensureNonEmpty(input.sourceEventType, "INVALID_NOTIFICATION_ROUTE");
    return this.db.notificationEventRoute.update({ where: { id: route.id }, data: input });
  }
  async createVersion(routeReference: string, input: { categoryKey: string; recipientPolicyVersionId: string; templateKey: string; templateVersionId: string; channelPolicy: unknown; fallbackPolicy: string; priority: string; quietHoursBypass: boolean; digestMode: string; expiryMinutes?: number | null }) {
    const route = await this.db.notificationEventRoute.findUnique({ where: { publicReference: routeReference } });
    if (!route) throw new NotificationPolicyError("NOTIFICATION_ROUTE_NOT_FOUND");
    const [category, policy, template, templateRoot] = await Promise.all([this.db.notificationCategory.findUnique({ where: { key: input.categoryKey } }), this.db.notificationRecipientPolicyVersion.findUnique({ where: { id: input.recipientPolicyVersionId } }), this.db.notificationTemplateVersion.findUnique({ where: { id: input.templateVersionId } }), this.db.notificationTemplate.findUnique({ where: { key: input.templateKey } })]);
    if (!category || category.status !== "ACTIVE" || !policy || policy.status !== "APPROVED" || !template || template.status !== "PUBLISHED" || template.purpose !== category.purpose || !templateRoot || template.templateId !== templateRoot.id) throw new NotificationPolicyError("INVALID_NOTIFICATION_ROUTE_DEPENDENCY");
    if (input.quietHoursBypass && !category.quietHoursBypass) throw new NotificationPolicyError("UNAPPROVED_QUIET_HOURS_BYPASS");
    const latest = await this.db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id }, orderBy: { versionNumber: "desc" } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    return this.db.notificationEventRouteVersion.create({ data: { publicReference: reference("nrv", `${route.id}:${versionNumber}`), routeId: route.id, versionNumber, status: "DRAFT", ...input } });
  }
  async approve(referenceValue: string, actorUserId: string) { return this.transition(referenceValue, "DRAFT", "APPROVED", { approvedByUserId: actorUserId, approvedAt: now() }); }
  async activate(referenceValue: string, actorUserId: string) {
    const version = await this.db.notificationEventRouteVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!version || version.status !== "APPROVED") throw new NotificationPolicyError("INVALID_NOTIFICATION_ROUTE_TRANSITION");
    if (version.approvedByUserId === actorUserId) throw new NotificationPolicyError("ROUTE_APPROVAL_SEPARATION_REQUIRED");
    const active = await this.db.notificationEventRouteVersion.findFirst({ where: { routeId: version.routeId, status: "ACTIVE" } });
    if (active) await this.db.notificationEventRouteVersion.update({ where: { id: active.id }, data: { status: "RETIRED", retiredAt: now() } });
    return this.db.notificationEventRouteVersion.update({ where: { id: version.id }, data: { status: "ACTIVE", activatedAt: now() } });
  }
  async retire(referenceValue: string) {
    const version = await this.db.notificationEventRouteVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!version) throw new NotificationPolicyError("NOTIFICATION_ROUTE_VERSION_NOT_FOUND");
    if (version.status === "RETIRED") return version;
    return this.db.notificationEventRouteVersion.update({ where: { id: version.id }, data: { status: "RETIRED", retiredAt: now() } });
  }
  async createRecipientPolicyVersion(input: { key: string; policy: { subject: RecipientSubject; role?: string } }) {
    if (!RECIPIENT_SUBJECTS.includes(input.policy.subject)) throw new NotificationPolicyError("INVALID_RECIPIENT_POLICY_SUBJECT");
    const latest = await this.db.notificationRecipientPolicyVersion.findFirst({ where: { key: input.key }, orderBy: { versionNumber: "desc" } });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    return this.db.notificationRecipientPolicyVersion.create({ data: { publicReference: reference("nrp", `${input.key}:${versionNumber}`), key: input.key, versionNumber, status: "DRAFT", policy: input.policy } });
  }
  async approveRecipientPolicy(referenceValue: string, actorUserId: string) {
    const policy = await this.db.notificationRecipientPolicyVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!policy || policy.status !== "DRAFT") throw new NotificationPolicyError("INVALID_RECIPIENT_POLICY_TRANSITION");
    return this.db.notificationRecipientPolicyVersion.update({ where: { id: policy.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: now() } });
  }
  private async transition(referenceValue: string, from: string, to: string, data: Record<string, unknown>) {
    const version = await this.db.notificationEventRouteVersion.findUnique({ where: { publicReference: referenceValue } });
    if (!version || version.status !== from) throw new NotificationPolicyError("INVALID_NOTIFICATION_ROUTE_TRANSITION");
    return this.db.notificationEventRouteVersion.update({ where: { id: version.id }, data: { status: to, ...data } });
  }
}

/** Resolves a bounded exact recipient projection. It intentionally has no all-admin query. */
export class RecipientPolicyService {
  constructor(private readonly db: any) {}
  async resolve(input: { policyVersionId: string; payload: Record<string, unknown> }) {
    const version = await this.db.notificationRecipientPolicyVersion.findUnique({ where: { id: input.policyVersionId } });
    if (!version || version.status !== "APPROVED") throw new NotificationPolicyError("RECIPIENT_POLICY_NOT_APPROVED");
    const policy = version.policy as { subject: RecipientSubject; role?: string };
    const fieldBySubject: Record<RecipientSubject, string> = {
      EVENT_ACTOR: "actorUserId", CUSTOMER: "customerUserId", STORE_OWNER: "storeOwnerUserId", AUTHORIZED_STORE_STAFF: "storeStaffUserId", ASSIGNED_DRIVER: "driverUserId", PROMOTER: "promoterUserId", RECRUITMENT_APPLICANT: "applicantUserId", ASSIGNED_RECRUITER: "recruiterUserId", ASSIGNED_HIRING_MANAGER: "hiringManagerUserId", FINANCE_ADMINISTRATOR: "financeAdministratorUserId", RECONCILIATION_ADMINISTRATOR: "reconciliationAdministratorUserId", SECURITY_ADMINISTRATOR: "securityAdministratorUserId",
    };
    const userId = input.payload[fieldBySubject[policy.subject]];
    if (typeof userId !== "string" || !userId) throw new NotificationPolicyError("RECIPIENT_NOT_RESOLVED");
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, emailVerifiedAt: true, status: true } });
    if (!user || user.status !== "ACTIVE" || (policy.role && user.role !== policy.role)) throw new NotificationPolicyError("RECIPIENT_NOT_RESOLVED");
    return { userId: user.id, roleProjection: policy.subject, verifiedEmail: Boolean(user.email && user.emailVerifiedAt), email: user.email as string | null };
  }
}

export class NotificationPreferenceService {
  constructor(private readonly db: any) {}
  async evaluate(input: { userId: string; category: any; channel: NotificationChannel; routeQuietHoursBypass?: boolean; routeDigestMode?: string; suppressed?: boolean; verifiedDestination?: boolean; at?: Date }) {
    const preference = await this.db.notificationPreference.findUnique({ where: { userId_categoryKey_channel: { userId: input.userId, categoryKey: input.category.key, channel: input.channel } } });
    const consent = await this.db.notificationConsentRecord.findFirst({ where: { userId: input.userId, channel: input.channel, purpose: "MARKETING" }, orderBy: { updatedAt: "desc" } });
    const mandatory = input.category.mandatory || ["SECURITY", "LEGAL"].includes(input.category.purpose);
    const optInExternalChannel = ["SMS", "WEB_PUSH", "ANDROID_PUSH"].includes(input.channel);
    if (!mandatory && optInExternalChannel && !["ENABLED", "MANDATORY"].includes(preference?.mode ?? "")) return { state: "BLOCKED" as const, reason: "PREFERENCE_DISABLED" };
    const preferenceMode = mandatory ? "MANDATORY" : input.category.preferenceControlled ? preference?.mode : undefined;
    const base = deliveryEligible({ purpose: input.category.purpose, channel: input.channel, preference: preferenceMode, consent: consent?.status, suppressed: input.suppressed, verifiedDestination: input.verifiedDestination });
    if (!base.eligible) return { state: "BLOCKED" as const, reason: base.reason };
    if (input.channel === "IN_APP") return { state: "IMMEDIATE" as const };
    const bypass = Boolean(input.category.quietHoursBypass && input.routeQuietHoursBypass);
    if (!bypass && preference?.quietHoursStart && preference?.quietHoursEnd && inQuietHours(preference.quietHoursStart, preference.quietHoursEnd, input.at ?? now(), preference.timezone, preference.quietHoursDays)) return { state: "QUEUED" as const, reason: "QUIET_HOURS" };
    const digest = preference?.digestMode ?? input.routeDigestMode;
    if (!mandatory && input.category.digestEligible && digest === "DAILY_DIGEST") return { state: "DIGEST" as const };
    return { state: "IMMEDIATE" as const };
  }
}

export function isValidNotificationTimezone(timezone: string | null | undefined): boolean {
  if (!timezone) return true;
  try { Intl.DateTimeFormat("en-ZA", { timeZone: timezone }).format(); return true; } catch { return false; }
}

export function inQuietHours(start: string, end: string, at: Date, timezone?: string | null, days: number[] = []) {
  const selectedTimezone = timezone || "Africa/Johannesburg";
  if (!isValidNotificationTimezone(selectedTimezone)) throw new NotificationPolicyError("INVALID_NOTIFICATION_TIMEZONE");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new NotificationPolicyError("INVALID_NOTIFICATION_QUIET_HOURS");
  const parts = new Intl.DateTimeFormat("en-ZA", { timeZone: selectedTimezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday") ?? "");
  if (days.length && !days.includes(weekday)) return false;
  const parse = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const from = parse(start), to = parse(end);
  return from === to ? false : from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

export class NotificationInboxService {
  constructor(private readonly db: any) {}
  async list(userId: string, skip: number, take: number) { const where = { ownerUserId: userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] }; const [items, total] = await Promise.all([this.db.notificationInboxItem.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }), this.db.notificationInboxItem.count({ where })]); return { items, total }; }
  async unreadCount(userId: string) { return this.db.notificationInboxItem.count({ where: { ownerUserId: userId, state: "UNREAD", OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] } }); }
  async changeState(userId: string, referenceValue: string, state: "READ" | "UNREAD" | "ARCHIVED") { const item = await this.db.notificationInboxItem.findFirst({ where: { ownerUserId: userId, publicReference: referenceValue } }); if (!item) throw new NotificationPolicyError("NOTIFICATION_INBOX_ITEM_NOT_FOUND"); if (item.expiresAt && item.expiresAt <= now()) throw new NotificationPolicyError("NOTIFICATION_INBOX_ITEM_EXPIRED"); if (item.state === "ARCHIVED" && state !== "ARCHIVED") throw new NotificationPolicyError("NOTIFICATION_INBOX_ITEM_ARCHIVED"); return this.db.notificationInboxItem.update({ where: { id: item.id }, data: state === "READ" ? { state, readAt: item.readAt ?? now() } : state === "UNREAD" ? { state, readAt: null } : { state, archivedAt: item.archivedAt ?? now() } }); }
  async readAll(userId: string) { return this.db.notificationInboxItem.updateMany({ where: { ownerUserId: userId, state: "UNREAD" }, data: { state: "READ", readAt: now() } }); }
}

export class NotificationEndpointService {
  constructor(private readonly db: any) {}
  async markStale(endpointId: string) {
    const endpoint = await this.db.notificationEndpoint.findUnique({ where: { id: endpointId } });
    if (!endpoint) throw new NotificationPolicyError("NOTIFICATION_ENDPOINT_NOT_FOUND");
    if (endpoint.status !== "ACTIVE") return endpoint;
    return this.db.notificationEndpoint.update({ where: { id: endpoint.id }, data: { status: "STALE" } });
  }
  async revoke(ownerUserId: string, referenceValue: string) {
    const endpoint = await this.db.notificationEndpoint.findFirst({ where: { ownerUserId, publicReference: referenceValue } });
    if (!endpoint) throw new NotificationPolicyError("NOTIFICATION_ENDPOINT_NOT_FOUND");
    return this.db.notificationEndpoint.update({ where: { id: endpoint.id }, data: { status: "REVOKED" } });
  }
}

export class NotificationSuppressionService {
  constructor(private readonly db: any) {}
  async isSuppressed(input: { userId?: string; endpointFingerprint?: string; channel: NotificationChannel; purpose: NotificationPurpose }) { return Boolean(await this.db.notificationSuppression.findFirst({ where: { active: true, channel: input.channel, OR: [{ userId: input.userId ?? undefined }, { endpointFingerprint: input.endpointFingerprint ?? undefined }], AND: [{ OR: [{ purpose: null }, { purpose: input.purpose }] }] } })); }
  async suppress(input: { userId?: string; endpointFingerprint?: string; channel?: NotificationChannel; purpose?: NotificationPurpose; reason: string; evidence?: Record<string, unknown> }) { return this.db.notificationSuppression.create({ data: { publicReference: reference("nsup", digest(input)), ...input, evidence: input.evidence ?? {} } }); }
}

export class NotificationDigestService {
  constructor(private readonly db: any) {}
  async add(input: { userId: string; channel: NotificationChannel; timezone: string; scheduledAt: Date; messageId: string; category: any; priority: string; expiresAt?: Date | null }) {
    if (!input.category.digestEligible || ["SECURITY", "LEGAL"].includes(input.category.purpose) || input.priority === "URGENT" || (input.expiresAt && input.expiresAt <= now())) throw new NotificationPolicyError("NOTIFICATION_NOT_DIGEST_ELIGIBLE");
    const identity = `${input.userId}:${input.channel}:${input.timezone}:${input.scheduledAt.toISOString()}`;
    const existing = await this.db.notificationDigestBucket.findFirst({ where: { userId: input.userId, channel: input.channel, scheduledAt: input.scheduledAt, status: "PENDING" } });
    if (existing) { if ((existing.includedMessageIds as string[]).includes(input.messageId)) return existing; return this.db.notificationDigestBucket.update({ where: { id: existing.id }, data: { includedMessageIds: [...existing.includedMessageIds, input.messageId] } }); }
    return this.db.notificationDigestBucket.create({ data: { publicReference: reference("ndig", identity), userId: input.userId, channel: input.channel, status: "PENDING", scheduledAt: input.scheduledAt, includedMessageIds: [input.messageId] } });
  }
}

export class NotificationReconciliationService {
  constructor(private readonly db: any) {}
  async open(input: { reason: string; sourceReceiptId?: string; deliveryId?: string; safeSummary: string; safeEvidence?: Record<string, unknown> }) { return this.db.notificationReconciliationCase.create({ data: { publicReference: reference("nrecase", digest(input)), reason: input.reason, sourceReceiptId: input.sourceReceiptId ?? null, deliveryId: input.deliveryId ?? null, safeSummary: input.safeSummary.slice(0, 500), safeEvidence: input.safeEvidence ?? {} } }); }
  async act(referenceValue: string, action: ReconciliationAction) { if (!RECONCILIATION_ACTIONS.includes(action)) throw new NotificationPolicyError("INVALID_RECONCILIATION_ACTION"); const item = await this.db.notificationReconciliationCase.findUnique({ where: { publicReference: referenceValue } }); if (!item) throw new NotificationPolicyError("NOTIFICATION_RECONCILIATION_NOT_FOUND"); return this.db.notificationReconciliationCase.update({ where: { id: item.id }, data: { status: "IN_PROGRESS", lastObservedAt: now(), safeEvidence: { ...(item.safeEvidence as object ?? {}), requestedAction: action } } }); }
  async converge(referenceValue: string) { const item = await this.db.notificationReconciliationCase.findUnique({ where: { publicReference: referenceValue } }); if (!item) throw new NotificationPolicyError("NOTIFICATION_RECONCILIATION_NOT_FOUND"); return this.db.notificationReconciliationCase.update({ where: { id: item.id }, data: { status: "CONVERGED", convergedAt: now(), lastObservedAt: now() } }); }
}

/** Bounded, idempotent source intake. The source event is never deleted. */
export class NotificationSourceIntakeService {
  constructor(private readonly db: any, private readonly recipients: RecipientPolicyService, private readonly reconciliation: NotificationReconciliationService) {}
  async intake(input: { sourceAuthority: string; sourceEventId: string; sourceEventType: string; aggregateReference: string; payload: Record<string, unknown>; occurredAt?: Date }) {
    ensureNonEmpty(input.sourceAuthority, "INVALID_NOTIFICATION_SOURCE_AUTHORITY"); ensureNonEmpty(input.sourceEventId, "INVALID_NOTIFICATION_SOURCE_EVENT"); ensureNonEmpty(input.sourceEventType, "INVALID_NOTIFICATION_SOURCE_EVENT");
    if (!KNOWN_NOTIFICATION_SOURCE_AUTHORITIES.includes(input.sourceAuthority as any)) throw new NotificationPolicyError("INVALID_NOTIFICATION_SOURCE_AUTHORITY");
    const payloadHash = digest(input.payload);
    const existing = await this.db.notificationSourceReceipt.findUnique({ where: { sourceAuthority_sourceEventId: { sourceAuthority: input.sourceAuthority, sourceEventId: input.sourceEventId } } });
    if (existing) { if (existing.payloadHash !== payloadHash) throw new NotificationPolicyError("NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT"); return { receipt: existing, replay: true }; }
    let receipt: any;
    try { receipt = await this.db.notificationSourceReceipt.create({ data: { publicReference: reference("nreceipt", `${input.sourceAuthority}:${input.sourceEventId}`), sourceAuthority: input.sourceAuthority, sourceEventId: input.sourceEventId, sourceEventType: input.sourceEventType, aggregateReference: input.aggregateReference, payloadHash, occurredAt: input.occurredAt ?? now(), status: "RECEIVED" } }); }
    catch (error: any) { if (error?.code !== "P2002") throw error; receipt = await this.db.notificationSourceReceipt.findUniqueOrThrow({ where: { sourceAuthority_sourceEventId: { sourceAuthority: input.sourceAuthority, sourceEventId: input.sourceEventId } } }); if (receipt.payloadHash !== payloadHash) throw new NotificationPolicyError("NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT"); return { receipt, replay: true }; }
    return { receipt, replay: false };
  }
  async fanout(input: { receiptId: string; payload: Record<string, unknown> }) {
    const work = (db: any) => this.fanoutInTransaction(db, input);
    return typeof this.db.$transaction === "function" ? this.db.$transaction(work) : work(this.db);
  }
  private async fanoutInTransaction(db: any, input: { receiptId: string; payload: Record<string, unknown> }) {
    const reconciliation = new NotificationReconciliationService(db);
    const recipients = new RecipientPolicyService(db);
    const receipt = await db.notificationSourceReceipt.findUnique({ where: { id: input.receiptId } });
    if (!receipt) throw new NotificationPolicyError("NOTIFICATION_SOURCE_RECEIPT_NOT_FOUND");
    if (receipt.status === "CONSUMED") return { replay: true, receipt };
    const route = await db.notificationEventRoute.findUnique({ where: { sourceAuthority_sourceEventType: { sourceAuthority: receipt.sourceAuthority, sourceEventType: receipt.sourceEventType } } });
    const version = route ? await db.notificationEventRouteVersion.findFirst({ where: { routeId: route.id, status: "ACTIVE" } }) : null;
    if (!version) { await reconciliation.open({ reason: "EVENT_ROUTE_NOT_CONFIGURED", sourceReceiptId: receipt.id, safeSummary: "No active notification route matches the source event.", safeEvidence: { sourceAuthority: receipt.sourceAuthority, sourceEventType: receipt.sourceEventType } }); await db.notificationSourceReceipt.update({ where: { id: receipt.id }, data: { status: "RECONCILIATION_REQUIRED" } }); return { replay: false, reconciliationRequired: true }; }
    try {
      const [category, recipient, template] = await Promise.all([db.notificationCategory.findUnique({ where: { key: version.categoryKey } }), recipients.resolve({ policyVersionId: version.recipientPolicyVersionId, payload: input.payload }), db.notificationTemplateVersion.findUnique({ where: { id: version.templateVersionId } })]);
      if (!category || category.status !== "ACTIVE" || !template || template.status !== "PUBLISHED") throw new NotificationPolicyError("NOTIFICATION_ROUTE_DEPENDENCY_RETIRED");
      const variablesHash = digest(input.payload);
      const prior = await db.notificationMessage.findFirst({ where: { sourceReceiptId: receipt.id, recipientUserId: recipient.userId } });
      if (prior) { if (prior.renderVariablesHash !== variablesHash) throw new NotificationPolicyError("NOTIFICATION_SOURCE_EVENT_PAYLOAD_CONFLICT"); return { replay: true, message: prior }; }
      const dedupeKey = digest({ sourceReceiptId: receipt.id, recipientUserId: recipient.userId, routeVersionId: version.id, variablesHash });
      const message = await db.notificationMessage.create({ data: { publicReference: reference("nmessage", dedupeKey), dedupeKey, sourceReceiptId: receipt.id, recipientUserId: recipient.userId, categoryKey: category.key, routeVersionId: version.id, templateVersionId: template.id, recipientPolicyVersionId: version.recipientPolicyVersionId, purpose: category.purpose, priority: version.priority, sensitivity: category.defaultSensitivity, renderVariablesHash: variablesHash, expiresAt: version.expiryMinutes ? new Date(Date.now() + version.expiryMinutes * 60_000) : null, status: "FANOUT_COMPLETED" } });
      await db.notificationRecipient.create({ data: { messageId: message.id, subjectUserId: recipient.userId, roleProjection: recipient.roleProjection } });
      await db.notificationSourceReceipt.update({ where: { id: receipt.id }, data: { status: "CONSUMED", routeVersionId: version.id, logicalMessageId: message.id } });
      return { replay: false, message, category, recipient, routeVersion: version };
    } catch (error) {
      if (error instanceof NotificationPolicyError && error.code === "RECIPIENT_NOT_RESOLVED") { await reconciliation.open({ reason: "RECIPIENT_NOT_RESOLVED", sourceReceiptId: receipt.id, safeSummary: "Configured recipient did not resolve to an eligible platform user." }); await db.notificationSourceReceipt.update({ where: { id: receipt.id }, data: { status: "RECONCILIATION_REQUIRED" } }); return { replay: false, reconciliationRequired: true }; }
      throw error;
    }
  }
}

/** The network boundary is always claim → provider call → immutable attempt finalization. */
export class NotificationDeliveryService {
  constructor(private readonly db: any, private readonly providers: ReadonlyMap<any, any>, private readonly suppressions: NotificationSuppressionService) {}
  async deliver(input: { deliveryId: string; destination: string; operationId: string }) {
    assertNotificationProductionReady();
    const delivery = await this.db.notificationDelivery.findUnique({ where: { id: input.deliveryId } });
    if (!delivery || !["QUEUED", "FAILED_RETRYABLE"].includes(delivery.status)) return delivery;
    if (delivery.expiresAt && delivery.expiresAt <= now()) return this.db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "EXPIRED" } });
    const claim = await this.db.notificationDelivery.updateMany({ where: { id: delivery.id, status: delivery.status }, data: { status: "SENDING" } });
    if (!claim.count) return this.db.notificationDelivery.findUnique({ where: { id: delivery.id } });
    const provider = this.providers.get(delivery.channel);
    if (!provider) throw new NotificationPolicyError("NOTIFICATION_PROVIDER_NOT_CONFIGURED");
    const attemptNumber = (await this.db.notificationDeliveryAttempt.count({ where: { deliveryId: delivery.id } })) + 1;
    const attempt = await this.db.notificationDeliveryAttempt.create({ data: { publicReference: reference("nattempt", `${delivery.id}:${attemptNumber}`), deliveryId: delivery.id, attemptNumber, operationId: input.operationId, provider: provider.name, status: "STARTED" } });
    const result = await provider.send({ destination: input.destination, subject: delivery.renderedTitle ?? undefined, body: delivery.renderedBody, idempotencyKey: attempt.publicReference });
    const failure = result.failureClass ?? "UNKNOWN_PROVIDER_FAILURE";
    const retryAt = result.accepted ? null : nextRetryAt({ failure, attemptNumber, retryAfterSeconds: result.retryAfterSeconds, expiresAt: delivery.expiresAt });
    await this.db.notificationDeliveryAttempt.update({ where: { id: attempt.id }, data: { status: result.accepted ? "PROVIDER_ACCEPTED" : "FAILED", completedAt: now(), providerMessageReference: result.providerMessageReference ?? null, failureClass: result.accepted ? null : result.failureClass ?? "UNKNOWN_PROVIDER_FAILURE", safeProviderCode: result.safeCode ?? null, nextAttemptAt: retryAt } });
    if (!result.accepted && ["INVALID_DESTINATION", "SUPPRESSED_DESTINATION"].includes(failure)) await this.suppressions.suppress({ channel: delivery.channel, reason: failure === "INVALID_DESTINATION" ? "REPEATED_PERMANENT_FAILURE" : "USER_REVOCATION", evidence: { deliveryReference: delivery.publicReference } });
    return this.db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: result.accepted ? "PROVIDER_ACCEPTED" : retryAt ? "FAILED_RETRYABLE" : "FAILED_PERMANENT", nextAttemptAt: retryAt, provider: provider.name, providerMessageReference: result.providerMessageReference ?? null } });
  }
  async expire(deliveryId: string) {
    const delivery = await this.db.notificationDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotificationPolicyError("NOTIFICATION_DELIVERY_NOT_FOUND");
    if (!["PENDING", "QUEUED", "FAILED_RETRYABLE", "SENDING"].includes(delivery.status)) return delivery;
    if (!delivery.expiresAt || delivery.expiresAt > now()) return delivery;
    return this.db.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "EXPIRED", nextAttemptAt: null } });
  }
  /** Receipt updates only advance state; provider acceptance is never delivery confirmation. */
  async ingestProviderReceipt(input: { provider: string; providerReceiptId: string; deliveryId: string; type: "ACCEPTED" | "DELIVERED" | "DEFERRED" | "BOUNCED" | "COMPLAINED" | "UNSUBSCRIBED" | "FAILED"; safePayload?: Record<string, unknown> }) {
    const current = await this.db.notificationDelivery.findUniqueOrThrow({ where: { id: input.deliveryId } });
    if (!current.provider || current.provider !== input.provider) throw new NotificationPolicyError("NOTIFICATION_PROVIDER_RECEIPT_MISMATCH");
    const priorReceipt = await this.db.notificationProviderReceipt.findUnique({ where: { provider_providerReceiptId: { provider: input.provider, providerReceiptId: input.providerReceiptId } } });
    if (priorReceipt && (priorReceipt.deliveryId !== input.deliveryId || priorReceipt.receiptType !== input.type)) throw new NotificationPolicyError("NOTIFICATION_PROVIDER_RECEIPT_CONFLICT");
    const receipt = await this.db.notificationProviderReceipt.upsert({ where: { provider_providerReceiptId: { provider: input.provider, providerReceiptId: input.providerReceiptId } }, update: {}, create: { publicReference: reference("npr", `${input.provider}:${input.providerReceiptId}`), provider: input.provider, providerReceiptId: input.providerReceiptId, deliveryId: input.deliveryId, receiptType: input.type, safePayload: input.safePayload ?? {} } });
    const status = ({ ACCEPTED: "PROVIDER_ACCEPTED", DELIVERED: "DELIVERED", DEFERRED: "FAILED_RETRYABLE", BOUNCED: "BOUNCED", COMPLAINED: "COMPLAINED", UNSUBSCRIBED: "SUPPRESSED", FAILED: "FAILED_PERMANENT" } as const)[input.type];
    const terminal = new Set(["DELIVERED", "BOUNCED", "COMPLAINED", "SUPPRESSED", "CANCELLED", "EXPIRED"]);
    if (!terminal.has(current.status) || current.status === status) await this.db.notificationDelivery.update({ where: { id: input.deliveryId }, data: { status } });
    return receipt;
  }
}

export function createNotificationAuthority(db: any, providers: ReadonlyMap<any, any>) {
  const categories = new NotificationCategoryService(db); const templates = new NotificationTemplateService(db); const routes = new NotificationRouteService(db); const recipients = new RecipientPolicyService(db); const suppressions = new NotificationSuppressionService(db); const reconciliation = new NotificationReconciliationService(db); const intake = new NotificationSourceIntakeService(db, recipients, reconciliation); const preferences = new NotificationPreferenceService(db); const inbox = new NotificationInboxService(db); const endpoints = new NotificationEndpointService(db); const digestService = new NotificationDigestService(db); const delivery = new NotificationDeliveryService(db, providers, suppressions);
  return Object.freeze({ categories, templates, routes, recipients, preferences, inbox, endpoints, suppressions, digests: digestService, reconciliation, intake, delivery });
}
