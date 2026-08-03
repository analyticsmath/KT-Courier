/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { APPLICATION_TRANSITIONS, DEVELOPER_SCOPE_KEYS, DEVELOPER_SCOPES, DeveloperApiError, type DeveloperScope, WEBHOOK_EVENT_CATALOG } from "./contracts";
import { assertDeveloperApiProductionReady } from "./production-readiness";
import { credentialFingerprint, credentialHash, decryptWebhookSecret, encryptWebhookSecret, generateCredential, generateWebhookSecret, maskCredential, maskSecret, opaqueReference, sha256, validateCredentialFormat, verifyCredentialHash } from "./crypto";

export const MAX_PUBLIC_BODY_BYTES = 64 * 1024;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 200;
export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
const DAY_MS = 86_400_000;

function nowDay(input = new Date()): Date { const day = new Date(input); day.setUTCHours(0, 0, 0, 0); return day; }
function safeJson(input: unknown): any { return JSON.parse(JSON.stringify(input)); }
function scopesFrom(value: unknown): string[] { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []; }
function onlyAllowedScopes(scopes: readonly string[]): asserts scopes is DeveloperScope[] { if (!scopes.length || scopes.some((scope) => !DEVELOPER_SCOPE_KEYS.includes(scope as DeveloperScope))) throw new DeveloperApiError("DEVELOPER_SCOPE_INVALID", 400, "A requested scope is not supported."); }

export function stableRequestHash(method: string, route: string, query: URLSearchParams, body: unknown): string {
  const pairs = [...query.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sha256(JSON.stringify({ method, route, query: pairs, body }));
}

export function requireIdempotencyKey(value: string | null): string {
  if (!value || value.trim().length === 0 || value.length > MAX_IDEMPOTENCY_KEY_LENGTH) throw new DeveloperApiError("IDEMPOTENCY_KEY_REQUIRED", 400, "A bounded Idempotency-Key header is required.");
  if (/authorization|bearer|secret|token/i.test(value)) throw new DeveloperApiError("IDEMPOTENCY_KEY_INVALID", 400, "The idempotency key is invalid.");
  return value;
}

export async function parseBoundedJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";")[0]?.toLowerCase();
  if (contentType !== "application/json") throw new DeveloperApiError("UNSUPPORTED_MEDIA_TYPE", 415, "Requests must use application/json.");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_PUBLIC_BODY_BYTES) throw new DeveloperApiError("REQUEST_TOO_LARGE", 413, "The request body is too large.");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_PUBLIC_BODY_BYTES) throw new DeveloperApiError("REQUEST_TOO_LARGE", 413, "The request body is too large.");
  try { const value = JSON.parse(text); if (!value || Array.isArray(value) || typeof value !== "object") throw new Error(); return value as Record<string, unknown>; }
  catch { throw new DeveloperApiError("INVALID_JSON", 400, "The JSON request body is invalid."); }
}

export function parsePagination(query: URLSearchParams, allowedFilters: readonly string[] = []): { limit: number; cursor: string | null; filters: Record<string, string> } {
  const allowed = new Set(["limit", "cursor", ...allowedFilters]);
  if ([...query.keys()].some((key) => !allowed.has(key))) throw new DeveloperApiError("PUBLIC_API_FILTER_INVALID", 400, "An unsupported filter was supplied.");
  if ([...query.keys()].length > 8) throw new DeveloperApiError("PUBLIC_API_FILTER_INVALID", 400, "Too many query parameters were supplied.");
  const rawLimit = query.get("limit") ?? String(DEFAULT_PAGE_LIMIT); const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) throw new DeveloperApiError("PUBLIC_API_PAGE_LIMIT_INVALID", 400, "The page limit is invalid.");
  const filters = Object.fromEntries(allowedFilters.flatMap((key) => query.get(key) === null ? [] : [[key, query.get(key)!]]));
  return { limit, cursor: query.get("cursor"), filters };
}

export class CursorService {
  constructor(private readonly key: string) { if (key.length < 32) throw new DeveloperApiError("PUBLIC_CURSOR_SIGNING_UNAVAILABLE", 503); }
  encode(input: Record<string, unknown>): string { const body = Buffer.from(JSON.stringify({ ...input, expiresAt: Date.now() + DAY_MS })).toString("base64url"); return `${body}.${createHmac("sha256", this.key).update(body).digest("base64url")}`; }
  decode(cursor: string, expected: Record<string, unknown>): Record<string, unknown> {
    const [body, signature, extra] = cursor.split("."); const expectedSignature = body ? createHmac("sha256", this.key).update(body).digest("base64url") : "";
    if (!body || !signature || extra || signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) throw new DeveloperApiError("PUBLIC_API_CURSOR_INVALID", 400, "The cursor is invalid.");
    try { const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); if (!parsed.expiresAt || parsed.expiresAt < Date.now() || Object.entries(expected).some(([key, value]) => parsed[key] !== value)) throw new Error(); return parsed; }
    catch { throw new DeveloperApiError("PUBLIC_API_CURSOR_INVALID", 400, "The cursor is invalid."); }
  }
}

export class DeveloperApplicationService {
  constructor(private readonly db: any) {}
  async create(input: { ownerUserId: string; storeId?: string | null; environment: "TEST" | "LIVE"; name: string; businessPurpose: string }) {
    if (input.environment === "LIVE") throw new DeveloperApiError("DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED", 423, "Live applications are not activated.");
    if (input.name.trim().length < 3 || input.name.length > 120 || input.businessPurpose.trim().length < 20 || input.businessPurpose.length > 2000) throw new DeveloperApiError("DEVELOPER_APPLICATION_INVALID", 400);
    return this.db.developerApplication.create({ data: { publicReference: opaqueReference("dapp"), ownerUserId: input.ownerUserId, storeId: input.storeId ?? null, environment: input.environment, name: input.name.trim(), businessPurpose: input.businessPurpose.trim() } });
  }
  async transition(application: any, target: string, actorUserId: string, options: { admin?: boolean; reason?: string } = {}) {
    const permitted = (APPLICATION_TRANSITIONS as Record<string, readonly string[]>)[application.status]?.includes(target);
    if (!permitted) throw new DeveloperApiError("DEVELOPER_APPLICATION_TRANSITION_INVALID", 409);
    if (!options.admin && application.ownerUserId !== actorUserId) throw new DeveloperApiError("DEVELOPER_APPLICATION_OWNER_DENIED", 403);
    if (["APPROVED", "UNDER_REVIEW", "REJECTED", "SUSPENDED", "REVOKED"].includes(target) && !options.admin) throw new DeveloperApiError("DEVELOPER_APPLICATION_REVIEW_REQUIRED", 403);
    const changed = await this.db.developerApplication.update({ where: { id: application.id }, data: { status: target, ...(target === "SUBMITTED" ? { submittedAt: new Date() } : {}), ...(target === "APPROVED" ? { approvedAt: new Date(), approvedByUserId: actorUserId, approvedOwnerSnapshot: { ownerUserId: application.ownerUserId, storeId: application.storeId }, approvedEnvironment: application.environment } : {}), ...(target === "SUSPENDED" ? { suspendedAt: new Date() } : {}), ...(target === "REVOKED" ? { revokedAt: new Date() } : {}), ...(target === "ARCHIVED" ? { archivedAt: new Date() } : {}), version: { increment: 1 } } });
    await this.db.developerApplicationReview.create({ data: { publicReference: opaqueReference("drev"), applicationId: application.id, reviewerUserId: options.admin ? actorUserId : null, decision: target, safeReason: options.reason?.slice(0, 500) ?? null } });
    return changed;
  }
}

export class DeveloperTermsService {
  constructor(private readonly db: any) {}
  async current(): Promise<any> { const terms = await this.db.developerTermsVersion.findFirst({ where: { status: "APPROVED", retiredAt: null }, orderBy: { publishedAt: "desc" } }); if (!terms) throw new DeveloperApiError("DEVELOPER_TERMS_CURRENT_VERSION_MISSING", 409, "No current developer terms are available."); return terms; }
  async accept(application: any, actorUserId: string, sourceEvidence: Record<string, unknown>) { if (application.ownerUserId !== actorUserId) throw new DeveloperApiError("DEVELOPER_APPLICATION_OWNER_DENIED", 403); const terms = await this.current(); return this.db.developerTermsAcceptance.upsert({ where: { applicationId_termsVersionId: { applicationId: application.id, termsVersionId: terms.id } }, update: {}, create: { publicReference: opaqueReference("dterms"), termsVersionId: terms.id, applicationId: application.id, ownerUserId: application.ownerUserId, actorUserId, sourceEvidence: safeJson(sourceEvidence) } }); }
  async assertAccepted(applicationId: string): Promise<void> { const current = await this.current(); const acceptance = await this.db.developerTermsAcceptance.findUnique({ where: { applicationId_termsVersionId: { applicationId, termsVersionId: current.id } } }); if (!acceptance) throw new DeveloperApiError("DEVELOPER_TERMS_ACCEPTANCE_REQUIRED", 409, "Current developer terms must be accepted."); }
}

export class ScopeGrantService {
  constructor(private readonly db: any) {}
  async createDraft(application: any, scopes: string[], actorUserId: string) {
    if (application.ownerUserId !== actorUserId) throw new DeveloperApiError("DEVELOPER_APPLICATION_OWNER_DENIED", 403); onlyAllowedScopes(scopes);
    const existing = await this.db.developerScopeGrant.count({ where: { applicationId: application.id } });
    return this.db.developerScopeGrant.create({ data: { publicReference: opaqueReference("dscope"), applicationId: application.id, version: existing + 1, ownerUserId: application.ownerUserId, storeId: application.storeId, environment: application.environment, scopes, apiVersion: "v1" } });
  }
  async approve(grant: any, application: any, adminUserId: string) {
    if (grant.ownerUserId !== application.ownerUserId || grant.environment !== application.environment) throw new DeveloperApiError("API_SCOPE_GRANT_MISMATCH", 409);
    const frozen = { applicationReference: application.publicReference, ownerUserId: grant.ownerUserId, storeId: grant.storeId, environment: grant.environment, scopes: scopesFrom(grant.scopes), apiVersion: grant.apiVersion, approvedBy: adminUserId, approvedAt: new Date().toISOString() };
    await this.db.developerScopeGrantVersion.create({ data: { publicReference: opaqueReference("dsgv"), grantId: grant.id, version: grant.version, frozenSnapshot: frozen } });
    return this.db.developerScopeGrant.update({ where: { id: grant.id }, data: { status: "ACTIVE", approvedByUserId: adminUserId, approvedAt: new Date(), effectiveAt: new Date() } });
  }
  assertScope(grant: any, required: DeveloperScope) { if (grant.status !== "ACTIVE" || !scopesFrom(grant.scopes).includes(required)) throw new DeveloperApiError("PUBLIC_API_SCOPE_DENIED", 403, "The credential is not authorized for this operation."); }
}

export class CredentialService {
  constructor(private readonly db: any, private readonly terms: DeveloperTermsService) {}
  async create(input: { application: any; scopeGrant: any; actorUserId: string; expiresAt?: Date | null }) {
    const { application, scopeGrant } = input;
    if (application.ownerUserId !== input.actorUserId || !["APPROVED", "ACTIVE"].includes(application.status)) throw new DeveloperApiError("DEVELOPER_CREDENTIAL_ISSUANCE_DENIED", 403);
    if (application.environment === "LIVE") throw new DeveloperApiError("DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED", 423);
    if (scopeGrant.applicationId !== application.id || scopeGrant.status !== "ACTIVE" || scopeGrant.environment !== application.environment) throw new DeveloperApiError("API_SCOPE_GRANT_MISMATCH", 409);
    await this.terms.assertAccepted(application.id);
    const credential = generateCredential(application.environment); const prefix = credential.slice(0, 15);
    const record = await this.db.developerApiCredential.create({ data: { publicReference: opaqueReference("dcred"), applicationId: application.id, scopeGrantId: scopeGrant.id, environment: application.environment, prefix, fingerprint: credentialFingerprint(credential), credentialHash: credentialHash(credential), maskedDisplay: maskCredential(credential), status: input.expiresAt && input.expiresAt.getTime() - Date.now() < 7 * DAY_MS ? "EXPIRING" : "ACTIVE", expiresAt: input.expiresAt ?? null } });
    return Object.freeze({ record, secret: credential });
  }
  async authenticate(raw: string, endpointEnvironment: "TEST" | "LIVE") {
    const statedEnvironment = validateCredentialFormat(raw);
    if (!statedEnvironment || statedEnvironment !== endpointEnvironment) throw new DeveloperApiError("PUBLIC_API_AUTHENTICATION_FAILED", 401, "Authentication failed.");
    const credential = await this.db.developerApiCredential.findUnique({ where: { fingerprint: credentialFingerprint(raw) } });
    if (!credential || !verifyCredentialHash(raw, credential.credentialHash)) throw new DeveloperApiError("PUBLIC_API_AUTHENTICATION_FAILED", 401, "Authentication failed.");
    const [application, grant] = await Promise.all([this.db.developerApplication.findUnique({ where: { id: credential.applicationId } }), this.db.developerScopeGrant.findUnique({ where: { id: credential.scopeGrantId } })]);
    if (!application || !grant || credential.environment !== endpointEnvironment || !["ACTIVE", "EXPIRING"].includes(credential.status) || credential.expiresAt && credential.expiresAt <= new Date() || !["APPROVED", "ACTIVE"].includes(application.status) || application.environment !== endpointEnvironment || grant.status !== "ACTIVE" || grant.environment !== endpointEnvironment) throw new DeveloperApiError("PUBLIC_API_AUTHENTICATION_FAILED", 401, "Authentication failed.");
    await this.db.developerApiCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
    return Object.freeze({ credential, application, grant, scopes: scopesFrom(grant.scopes) });
  }
  async revoke(credential: any) { return this.db.developerApiCredential.update({ where: { id: credential.id }, data: { status: "REVOKED", revokedAt: new Date() } }); }
  async compromise(credential: any) { return this.db.developerApiCredential.update({ where: { id: credential.id }, data: { status: "COMPROMISED", revokedAt: new Date() } }); }
  async rotate(input: { credential: any; application: any; scopeGrant: any; actorUserId: string; overlapMinutes?: number }) { const created = await this.create({ application: input.application, scopeGrant: input.scopeGrant, actorUserId: input.actorUserId }); const overlapEndsAt = new Date(Date.now() + Math.min(Math.max(input.overlapMinutes ?? 60, 1), 1440) * 60_000); await this.db.developerApiCredentialRotation.create({ data: { publicReference: opaqueReference("drot"), previousCredentialId: input.credential.id, replacementCredentialId: created.record.id, overlapEndsAt } }); await this.db.developerApiCredential.update({ where: { id: input.credential.id }, data: { status: "EXPIRING", expiresAt: input.credential.expiresAt && input.credential.expiresAt < overlapEndsAt ? input.credential.expiresAt : overlapEndsAt } }); return created; }
}

export class IdempotencyService {
  constructor(private readonly db: any) {}
  async begin(input: { credentialId: string; applicationId: string; environment: "TEST" | "LIVE"; method: string; route: string; key: string; requestHash: string }) {
    const keyHash = sha256(input.key); const where = { credentialId_method_normalizedRoute_idempotencyKeyHash: { credentialId: input.credentialId, method: input.method, normalizedRoute: input.route, idempotencyKeyHash: keyHash } }; const existing = await this.db.developerApiIdempotencyRecord.findUnique({ where });
    if (existing) { if (existing.requestHash !== input.requestHash) throw new DeveloperApiError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST", 409); if (existing.status === "COMPLETED" && existing.responseStatus && existing.responseBody) return { replay: existing }; if (existing.status === "RECORDED") throw new DeveloperApiError("IDEMPOTENCY_REQUEST_IN_PROGRESS", 409); }
    const record = await this.db.developerApiIdempotencyRecord.create({ data: { publicReference: opaqueReference("didem"), credentialId: input.credentialId, applicationId: input.applicationId, environment: input.environment, method: input.method, normalizedRoute: input.route, idempotencyKeyHash: keyHash, requestHash: input.requestHash, expiresAt: new Date(Date.now() + DAY_MS) } }); return { record };
  }
  async complete(record: any, status: number, body: unknown, reference?: string) { return this.db.developerApiIdempotencyRecord.update({ where: { id: record.id }, data: { status: "COMPLETED", responseStatus: status, responseBody: safeJson(body), responseBodyHash: sha256(JSON.stringify(body)), canonicalResultReference: reference ?? null } }); }
}

export class DbRateLimitService {
  constructor(private readonly db: any) {}
  async check(input: { policyId: string; dimensions?: Readonly<{ credential: string; application: string; resourceOwner: string; scope: string; routeClass: string; environment: "TEST" | "LIVE" }>; identity?: string; maximum: number; windowSeconds: number; now?: Date }): Promise<{ ok: boolean; retryAfterSeconds?: number }> {
    if (!Number.isInteger(input.maximum) || input.maximum < 1 || input.maximum > 1_000_000 || !Number.isInteger(input.windowSeconds) || input.windowSeconds < 1 || input.windowSeconds > 86_400) throw new DeveloperApiError("API_RATE_POLICY_INVALID", 503, "The active rate policy is invalid.");
    const now = input.now ?? new Date(); const started = new Date(Math.floor(now.getTime() / (input.windowSeconds * 1000)) * input.windowSeconds * 1000);
    const identity = input.dimensions ? JSON.stringify({ credential: input.dimensions.credential, application: input.dimensions.application, resourceOwner: input.dimensions.resourceOwner, scope: input.dimensions.scope, routeClass: input.dimensions.routeClass, environment: input.dimensions.environment }) : input.identity;
    if (!identity) throw new DeveloperApiError("API_RATE_IDENTITY_INVALID", 503, "A complete rate-limit identity is required.");
    const identityHash = sha256(identity); const where = { policyId_identityHash_windowStartedAt: { policyId: input.policyId, identityHash, windowStartedAt: started } };
    const retryAfterSeconds = Math.max(1, input.windowSeconds - Math.floor((now.getTime() - started.getTime()) / 1000));
    // updateMany with a count predicate is the atomic increment gate.  The
    // initial insert race is retried against that same gate rather than
    // allowing a best-effort/in-memory fallback.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await this.db.developerApiRateUsage.findUnique({ where });
      if (existing) {
        const updated = await this.db.developerApiRateUsage.updateMany({ where: { id: existing.id, count: { lt: input.maximum } }, data: { count: { increment: 1 } } });
        return updated.count === 1 ? { ok: true } : { ok: false, retryAfterSeconds };
      }
      try { await this.db.developerApiRateUsage.create({ data: { policyId: input.policyId, identityHash, windowStartedAt: started, count: 1 } }); return { ok: true }; }
      catch (error: any) { if (error?.code !== "P2002" || attempt === 2) throw error; }
    }
    throw new DeveloperApiError("API_RATE_COUNTER_UNAVAILABLE", 503, "Rate limiting is temporarily unavailable.");
  }
}

export class DbQuotaService {
  constructor(private readonly db: any) {}
  async consume(input: { applicationId: string; ownerUserId?: string; applicationOwnerUserId?: string; environment?: "TEST" | "LIVE"; applicationEnvironment?: "TEST" | "LIVE"; policyId: string; counter: "requests" | "quotes" | "orders" | "webhookSubscriptions" | "webhookVerifications" | "deliveryRetries" | string; maximum: number; period?: "DAY"; now?: Date }): Promise<boolean> {
    if (!Number.isInteger(input.maximum) || input.maximum < 0 || input.maximum > 1_000_000) throw new DeveloperApiError("API_QUOTA_POLICY_INVALID", 503, "The active quota policy is invalid.");
    if (input.ownerUserId && input.applicationOwnerUserId && input.ownerUserId !== input.applicationOwnerUserId) throw new DeveloperApiError("API_QUOTA_OWNER_MISMATCH", 403, "The quota owner does not match the application.");
    if (input.environment && input.applicationEnvironment && input.environment !== input.applicationEnvironment) throw new DeveloperApiError("API_QUOTA_ENVIRONMENT_MISMATCH", 403, "The quota environment does not match the application.");
    const period = input.period ?? "DAY"; const periodStartedAt = nowDay(input.now); const where = { applicationId_policyId_period_periodStartedAt: { applicationId: input.applicationId, policyId: input.policyId, period, periodStartedAt } };
    // Serializable transactions protect the JSON counter rollover from lost
    // updates while keeping policy versions immutable and database-backed.
    for (let attempt = 0; attempt < 3; attempt += 1) try {
      return await this.db.$transaction(async (tx: any) => {
        const existing = await tx.developerApiQuotaUsage.findUnique({ where }); const counters = ((existing?.counters ?? {}) as Record<string, number>);
        const current = counters[input.counter] ?? 0; if (!Number.isInteger(current) || current < 0 || current >= input.maximum) return false;
        const next = { ...counters, [input.counter]: current + 1 };
        if (existing) await tx.developerApiQuotaUsage.update({ where: { id: existing.id }, data: { counters: next } });
        else await tx.developerApiQuotaUsage.create({ data: { applicationId: input.applicationId, policyId: input.policyId, period, periodStartedAt, counters: next } });
        return true;
      }, { isolationLevel: "Serializable" });
    } catch (error: any) { if (error?.code !== "P2034" || attempt === 2) throw error; }
    throw new DeveloperApiError("API_QUOTA_COUNTER_UNAVAILABLE", 503, "Quota accounting is temporarily unavailable.");
  }
}

function forbiddenAddress(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1" || lower === "localhost" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("ff")) return true;
  if (lower.startsWith("127.") || lower.startsWith("10.") || lower.startsWith("192.168.") || lower.startsWith("169.254.") || lower.startsWith("0.") || lower.startsWith("100.64.") || lower === "169.254.169.254") return true;
  const parts = lower.split("."); const first = Number(parts[0]); const second = Number(parts[1]); return (first === 172 && second >= 16 && second <= 31) || first >= 224 || first === 198 && (second === 18 || second === 19) || first === 192 && second === 0;
}
export async function validateWebhookEndpoint(raw: string, options: { resolver?: (host: string) => Promise<{ address: string }[]>; production?: boolean } = {}): Promise<{ url: URL; fingerprint: string; masked: string }> {
  let url: URL; try { url = new URL(raw); } catch { throw new DeveloperApiError("WEBHOOK_ENDPOINT_INVALID", 400, "The webhook endpoint is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || raw.length > 2048 || isIP(url.hostname) || url.hostname === "localhost") throw new DeveloperApiError("WEBHOOK_ENDPOINT_UNSAFE", 400, "The webhook endpoint is not permitted.");
  const resolved = await (options.resolver ? options.resolver(url.hostname) : lookup(url.hostname, { all: true })); if (!resolved.length || resolved.some((entry) => forbiddenAddress(entry.address))) throw new DeveloperApiError("WEBHOOK_ENDPOINT_UNSAFE", 400, "The webhook endpoint is not permitted.");
  return { url, fingerprint: sha256(url.toString()), masked: `${url.protocol}//${url.hostname.slice(0, 4)}••••` };
}

export function createCloudEvent(input: { id: string; type: string; subject: string; time: Date; data: Record<string, unknown> }) { return Object.freeze({ specversion: "1.0", id: input.id, source: "https://api.ktcouriers.example", type: input.type, time: input.time.toISOString(), subject: input.subject, datacontenttype: "application/json", dataschema: `/openapi/kt-couriers-v1.json#/components/schemas/${input.type}`, data: input.data }); }
export function contentDigest(rawBody: Buffer): string { return `sha-256=:${Buffer.from(sha256(rawBody), "hex").toString("base64")}:`; }
export function signWebhookRequest(input: { secret: string; method: string; targetUri: string; rawBody: Buffer; webhookId: string; timestamp: string; keyId: string }) {
  const digest = contentDigest(input.rawBody); const covered = `@method: ${input.method.toLowerCase()}\n@target-uri: ${input.targetUri}\ncontent-digest: ${digest}\ncontent-type: application/json\nx-kt-webhook-id: ${input.webhookId}\nx-kt-webhook-timestamp: ${input.timestamp}`; const signature = createHmac("sha256", input.secret).update(covered).digest("base64"); return Object.freeze({ "content-digest": digest, "signature-input": `sig1=("@method" "@target-uri" "content-digest" "content-type" "x-kt-webhook-id" "x-kt-webhook-timestamp");created=${Math.floor(Date.parse(input.timestamp) / 1000)};keyid="${input.keyId}";alg="hmac-sha256"`, signature: `sig1=:${signature}:`, "x-kt-webhook-id": input.webhookId, "x-kt-webhook-timestamp": input.timestamp, "content-type": "application/json" }); }
export function classifyWebhookResponse(status: number | null, failure?: string): { retryable: boolean; failureClass?: string; disableEndpoint?: boolean } { if (failure) return { retryable: true, failureClass: "TRANSIENT_NETWORK" }; if (status && status >= 200 && status < 300) return { retryable: false }; if (status === 410) return { retryable: false, disableEndpoint: true, failureClass: "INVALID_ENDPOINT" }; if (status === 408 || status === 425 || status === 429 || status !== null && status >= 500) return { retryable: true, failureClass: status === 429 ? "RATE_LIMIT" : "SERVER_ERROR" }; return { retryable: false, failureClass: "CLIENT_ERROR" }; }
export function classifyWebhookFailure(error: unknown): { retryable: boolean; failureClass: string } { if (error instanceof DeveloperApiError) { if (error.code === "WEBHOOK_RESPONSE_TOO_LARGE") return { retryable: false, failureClass: "RESPONSE_TOO_LARGE" }; if (/ENDPOINT|DNS|TLS|REDIRECT/.test(error.code)) return { retryable: false, failureClass: error.code.includes("TLS") ? "INVALID_TLS" : "BLOCKED_DESTINATION" }; } return { retryable: true, failureClass: "TRANSIENT_NETWORK" }; }
export function retryAt(attempt: number, retryAfterSeconds?: number): Date { const exponential = Math.min(3600, 30 * 2 ** Math.min(attempt, 7)); const safeRetryAfter = Number.isFinite(retryAfterSeconds) ? Math.min(Math.max(retryAfterSeconds ?? 0, 0), 3600) : 0; const seconds = Math.max(exponential, safeRetryAfter) + Math.floor(Math.random() * 15); return new Date(Date.now() + seconds * 1000); }

export class WebhookSubscriptionService {
  constructor(private readonly db: any) {}
  async create(input: { application: any; scopes: readonly string[]; endpoint: string; eventTypes: string[]; resolver?: (host: string) => Promise<{ address: string }[]> }) {
    if (!input.scopes.includes(DEVELOPER_SCOPES.WEBHOOKS_WRITE)) throw new DeveloperApiError("PUBLIC_API_SCOPE_DENIED", 403); if (!input.eventTypes.length || input.eventTypes.some((event) => !(event in WEBHOOK_EVENT_CATALOG))) throw new DeveloperApiError("WEBHOOK_EVENT_TYPE_INVALID", 400);
    const endpoint = await validateWebhookEndpoint(input.endpoint, { resolver: input.resolver }); const subscription = await this.db.developerWebhookSubscription.create({ data: { publicReference: opaqueReference("dwh"), applicationId: input.application.id, environment: input.application.environment, endpointFingerprint: endpoint.fingerprint, encryptedEndpoint: encryptWebhookSecret(endpoint.url.toString()), maskedEndpoint: endpoint.masked, status: "DRAFT", eventSelection: input.eventTypes } }); await this.db.developerWebhookSubscriptionVersion.create({ data: { publicReference: opaqueReference("dwhv"), subscriptionId: subscription.id, version: subscription.version, endpointFingerprint: endpoint.fingerprint, eventSelection: input.eventTypes } }); const secret = generateWebhookSecret(); const secretRecord = await this.db.developerWebhookSecret.create({ data: { publicReference: opaqueReference("dwhs"), subscriptionId: subscription.id, version: 1, encryptedSecret: encryptWebhookSecret(secret), fingerprint: sha256(secret), maskedDisplay: maskSecret(secret), status: "CURRENT" } }); return Object.freeze({ subscription, secret: { reference: secretRecord.publicReference, value: secret } });
  }
  async update(subscription: any, input: { endpoint?: string; eventTypes?: string[]; resolver?: (host: string) => Promise<{ address: string }[]> }) { if (["REVOKED", "DISABLED"].includes(subscription.status)) throw new DeveloperApiError("WEBHOOK_SUBSCRIPTION_NOT_MUTABLE", 409); const eventTypes = input.eventTypes ?? scopesFrom(subscription.eventSelection); if (!eventTypes.length || eventTypes.some((event) => !(event in WEBHOOK_EVENT_CATALOG))) throw new DeveloperApiError("WEBHOOK_EVENT_TYPE_INVALID", 400); const endpoint = input.endpoint ? await validateWebhookEndpoint(input.endpoint, { resolver: input.resolver }) : null; const updated = await this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { ...(endpoint ? { endpointFingerprint: endpoint.fingerprint, encryptedEndpoint: encryptWebhookSecret(endpoint.url.toString()), maskedEndpoint: endpoint.masked } : {}), eventSelection: eventTypes, status: "DRAFT", verifiedAt: null, version: { increment: 1 } } }); await this.db.developerWebhookSubscriptionVersion.create({ data: { publicReference: opaqueReference("dwhv"), subscriptionId: updated.id, version: updated.version, endpointFingerprint: updated.endpointFingerprint, eventSelection: eventTypes } }); return updated; }
  async requestVerification(subscription: any) { if (["REVOKED", "DISABLED"].includes(subscription.status)) throw new DeveloperApiError("WEBHOOK_SUBSCRIPTION_NOT_VERIFIABLE", 409); const challenge = `ktv_${randomUUID()}`; const verification = await this.db.developerWebhookVerification.create({ data: { publicReference: opaqueReference("dverify"), subscriptionId: subscription.id, challengeHash: sha256(challenge), encryptedChallenge: encryptWebhookSecret(challenge), expiresAt: new Date(Date.now() + 15 * 60_000) } }); await this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "VERIFYING" } }); return Object.freeze({ verification, challenge }); }
  async completeVerification(subscription: any, challenge: string) { const verification = await this.db.developerWebhookVerification.findFirst({ where: { subscriptionId: subscription.id, status: "PENDING" }, orderBy: { createdAt: "desc" } }); if (!verification || verification.expiresAt <= new Date() || verification.challengeHash !== sha256(challenge)) throw new DeveloperApiError("WEBHOOK_VERIFICATION_FAILED", 409, "Endpoint verification failed."); const consumed = await this.db.developerWebhookVerification.updateMany({ where: { id: verification.id, status: "PENDING", challengeHash: verification.challengeHash, expiresAt: { gt: new Date() } }, data: { status: "SUCCEEDED", verifiedAt: new Date(), attempts: { increment: 1 } } }); if (consumed.count !== 1) throw new DeveloperApiError("WEBHOOK_VERIFICATION_REPLAYED", 409, "Endpoint verification failed."); return this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", verifiedAt: new Date() } }); }
  async rotateSecret(subscription: any) { if (subscription.status === "REVOKED") throw new DeveloperApiError("WEBHOOK_SUBSCRIPTION_REVOKED", 409); const existing = await this.db.developerWebhookSecret.findMany({ where: { subscriptionId: subscription.id, status: { in: ["CURRENT", "NEXT"] } }, orderBy: { version: "desc" } }); const version = (existing[0]?.version ?? 0) + 1; const secret = generateWebhookSecret(); await this.db.developerWebhookSecret.updateMany({ where: { subscriptionId: subscription.id, status: "CURRENT" }, data: { status: "RETIRED", expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } }); const record = await this.db.developerWebhookSecret.create({ data: { publicReference: opaqueReference("dwhs"), subscriptionId: subscription.id, version, encryptedSecret: encryptWebhookSecret(secret), fingerprint: sha256(secret), maskedDisplay: maskSecret(secret), status: "CURRENT" } }); return Object.freeze({ record, secret }); }
  async pause(subscription: any) { if (subscription.status !== "ACTIVE") throw new DeveloperApiError("WEBHOOK_SUBSCRIPTION_NOT_PAUSABLE", 409); return this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "PAUSED", pausedAt: new Date() } }); }
  async resume(subscription: any) { if (subscription.status !== "PAUSED" || !subscription.verifiedAt) throw new DeveloperApiError("WEBHOOK_VERIFICATION_REQUIRED", 409, "A verified paused endpoint is required."); return this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", pausedAt: null } }); }
  async revoke(subscription: any) { if (["REVOKED", "DISABLED"].includes(subscription.status)) throw new DeveloperApiError("WEBHOOK_SUBSCRIPTION_NOT_MUTABLE", 409); return this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "REVOKED", revokedAt: new Date() } }); }
  async disable(subscription: any) { if (["REVOKED", "DISABLED"].includes(subscription.status)) return subscription; return this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "DISABLED", pausedAt: new Date() } }); }
  async requestDeliveryRetry(delivery: any) { if (delivery.status !== "FAILED_RETRYABLE" || delivery.attemptCount >= 12 || delivery.expiresAt && delivery.expiresAt <= new Date()) throw new DeveloperApiError("WEBHOOK_DELIVERY_NOT_RETRYABLE", 409, "The delivery cannot be retried."); return this.db.developerWebhookDelivery.update({ where: { id: delivery.id }, data: { status: "PENDING", nextAttemptAt: new Date() } }); }
  async secretForDelivery(subscriptionId: string, version: number): Promise<string> { const secret = await this.db.developerWebhookSecret.findUnique({ where: { subscriptionId_version: { subscriptionId, version } } }); if (!secret || secret.status !== "CURRENT" || secret.expiresAt && secret.expiresAt <= new Date()) throw new DeveloperApiError("WEBHOOK_SECRET_VERSION_MISSING", 409); return decryptWebhookSecret(secret.encryptedSecret); }
  async currentSecret(subscriptionId: string): Promise<{ value: string; version: number }> { const secret = await this.db.developerWebhookSecret.findFirst({ where: { subscriptionId, status: "CURRENT", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { version: "desc" } }); if (!secret) throw new DeveloperApiError("WEBHOOK_SECRET_VERSION_MISSING", 409); return { value: decryptWebhookSecret(secret.encryptedSecret), version: secret.version }; }
}

export type WebhookHttpResponse = Readonly<{ status: number; headers: Headers; body: string }>;
export interface WebhookHttpClient { send(input: Readonly<{ url: string; headers: Record<string, string>; body: Buffer; timeoutMs: number }>): Promise<WebhookHttpResponse>; }
export class FetchWebhookHttpClient implements WebhookHttpClient {
  async send(input: Readonly<{ url: string; headers: Record<string, string>; body: Buffer; timeoutMs: number }>): Promise<WebhookHttpResponse> { const signal = AbortSignal.timeout(input.timeoutMs); const response = await fetch(input.url, { method: "POST", headers: input.headers, body: new Uint8Array(input.body), redirect: "manual", signal }); const contentLength = Number(response.headers.get("content-length") ?? "0"); if (contentLength > 32_768) throw new DeveloperApiError("WEBHOOK_RESPONSE_TOO_LARGE", 502, "Webhook response exceeded the limit."); const reader = response.body?.getReader(); let received = 0; const chunks: Uint8Array[] = []; if (reader) { for (;;) { const chunk = await reader.read(); if (chunk.done) break; received += chunk.value.byteLength; if (received > 32_768) { await reader.cancel(); throw new DeveloperApiError("WEBHOOK_RESPONSE_TOO_LARGE", 502, "Webhook response exceeded the limit."); } chunks.push(chunk.value); } } return { status: response.status, headers: response.headers, body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8") }; }
}

export class WebhookExecutionService {
  constructor(private readonly db: any, private readonly subscriptions: WebhookSubscriptionService, private readonly http: WebhookHttpClient = new FetchWebhookHttpClient()) {}
  async verify(verification: any, subscription: any) {
    assertDeveloperApiProductionReady();
    if (verification.status !== "PENDING" || verification.expiresAt <= new Date() || subscription.status !== "VERIFYING") throw new DeveloperApiError("WEBHOOK_VERIFICATION_NOT_PENDING", 409);
    if (verification.attempts >= 5) { await this.db.developerWebhookVerification.update({ where: { id: verification.id }, data: { status: "FAILED" } }); await this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "VERIFICATION_FAILED" } }); throw new DeveloperApiError("WEBHOOK_VERIFICATION_ATTEMPTS_EXHAUSTED", 409); }
    const endpoint = decryptWebhookSecret(subscription.encryptedEndpoint); await validateWebhookEndpoint(endpoint); const challenge = decryptWebhookSecret(verification.encryptedChallenge); const currentSecret = await this.subscriptions.currentSecret(subscription.id); const raw = Buffer.from(JSON.stringify(createCloudEvent({ id: verification.publicReference, type: "za.co.ktcouriers.webhook.verification.v1", subject: subscription.publicReference, time: new Date(), data: { challenge } }))); const signed = signWebhookRequest({ secret: currentSecret.value, method: "POST", targetUri: endpoint, rawBody: raw, webhookId: verification.publicReference, timestamp: new Date().toISOString(), keyId: `v${currentSecret.version}` });
    try { const result = await this.http.send({ url: endpoint, headers: { ...signed, "user-agent": "KT-Couriers-Webhook/1.0", accept: "text/plain" }, body: raw, timeoutMs: 8_000 }); if (result.status < 200 || result.status >= 300 || result.body.trim() !== challenge) throw new DeveloperApiError("WEBHOOK_VERIFICATION_FAILED", 409, "Webhook endpoint verification failed."); return this.subscriptions.completeVerification(subscription, challenge); } catch (error) { await this.db.developerWebhookVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 }, ...(verification.attempts + 1 >= 5 ? { status: "FAILED" } : {}) } }); if (verification.attempts + 1 >= 5) await this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "VERIFICATION_FAILED" } }); throw error; }
  }
  async deliver(delivery: any, event: any, subscription: any) {
    assertDeveloperApiProductionReady();
    if (!["PENDING", "FAILED_RETRYABLE"].includes(delivery.status) || subscription.status !== "ACTIVE" || delivery.expiresAt && delivery.expiresAt <= new Date()) throw new DeveloperApiError("WEBHOOK_DELIVERY_NOT_ELIGIBLE", 409); if (delivery.attemptCount >= 12) { await this.db.developerWebhookDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED_PERMANENT", nextAttemptAt: null } }); throw new DeveloperApiError("WEBHOOK_DELIVERY_ATTEMPTS_EXHAUSTED", 409); }
    const claimed = await this.db.developerWebhookDelivery.updateMany({ where: { id: delivery.id, status: { in: ["PENDING", "FAILED_RETRYABLE"] } }, data: { status: "CLAIMED", lastAttemptedAt: new Date() } }); if (claimed.count !== 1) throw new DeveloperApiError("WEBHOOK_DELIVERY_ALREADY_CLAIMED", 409);
    const attemptNumber = delivery.attemptCount + 1; const operationId = `dwh:${delivery.publicReference}:${attemptNumber}`; const attempt = await this.db.developerWebhookAttempt.create({ data: { publicReference: opaqueReference("dwhat"), deliveryId: delivery.id, attemptNumber, operationId, endpointVersion: delivery.endpointVersion, secretVersion: delivery.secretVersion } });
    try { const endpoint = decryptWebhookSecret(subscription.encryptedEndpoint); await validateWebhookEndpoint(endpoint); const secret = await this.subscriptions.secretForDelivery(subscription.id, delivery.secretVersion); const body = Buffer.from(JSON.stringify(createCloudEvent({ id: event.publicReference, type: event.eventType, subject: event.subjectReference, time: event.occurredAt, data: event.payload }))); const timestamp = new Date().toISOString(); const signed = signWebhookRequest({ secret, method: "POST", targetUri: endpoint, rawBody: body, webhookId: delivery.publicReference, timestamp, keyId: `v${delivery.secretVersion}` }); const response = await this.http.send({ url: endpoint, headers: { ...signed, "user-agent": "KT-Couriers-Webhook/1.0", accept: "application/json" }, body, timeoutMs: 10_000 }); const decision = classifyWebhookResponse(response.status); const nextAttemptAt = decision.retryable ? retryAt(attemptNumber, Number(response.headers.get("retry-after") ?? 0)) : null; await this.db.developerWebhookAttempt.update({ where: { id: attempt.id }, data: { status: decision.retryable || response.status < 200 || response.status >= 300 ? "FAILED" : "SUCCEEDED", httpStatus: response.status, responsePreviewHash: sha256(response.body.slice(0, 512)), failureClass: decision.failureClass ?? null, completedAt: new Date(), nextAttemptAt } }); if (decision.disableEndpoint) await this.db.developerWebhookSubscription.update({ where: { id: subscription.id }, data: { status: "DISABLED", pausedAt: new Date() } }); return this.db.developerWebhookDelivery.update({ where: { id: delivery.id }, data: { attemptCount: attemptNumber, status: response.status >= 200 && response.status < 300 ? "SUCCEEDED" : decision.disableEndpoint ? "ENDPOINT_DISABLED" : decision.retryable ? "FAILED_RETRYABLE" : "FAILED_PERMANENT", nextAttemptAt } });
    } catch (error) { const decision = classifyWebhookFailure(error); const nextAttemptAt = decision.retryable ? retryAt(attemptNumber) : null; await this.db.developerWebhookAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", failureClass: decision.failureClass, completedAt: new Date(), nextAttemptAt } }); await this.db.developerWebhookDelivery.update({ where: { id: delivery.id }, data: { attemptCount: attemptNumber, status: decision.retryable ? "FAILED_RETRYABLE" : "FAILED_PERMANENT", nextAttemptAt } }); throw error; }
  }
}
