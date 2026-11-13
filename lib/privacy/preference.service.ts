/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { withSerializableRetry } from "@/lib/db/serializable-retry";

export const MARKETING_CHANNELS = ["EMAIL", "SMS", "WEB_PUSH", "ANDROID_PUSH"] as const;
export const COOKIE_SCHEMA_VERSION = "v1";
export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];
export type CookiePreferenceState = { functional: boolean; analytics: boolean; marketing: boolean };

export class PrivacyPreferenceError extends Error { constructor(readonly code: string, message = code) { super(message); this.name = "PrivacyPreferenceError"; } }
const ref = (prefix: string) => `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
export const hashAnonymousCookieSubject = (value: string) => createHash("sha256").update(value).digest("hex");

export async function getMarketingPreferences(userId: string) {
  const records = await (prisma as any).notificationConsentRecord.findMany({ where: { userId, purpose: "MARKETING", channel: { in: MARKETING_CHANNELS } }, orderBy: { updatedAt: "desc" } });
  return MARKETING_CHANNELS.map((channel) => {
    const record = records.find((item: any) => item.channel === channel);
    return { channel, status: record?.status ?? "NOT_REQUESTED", updatedAt: record?.updatedAt ?? null };
  });
}

export async function setMarketingPreference(input: { userId: string; channel: MarketingChannel; optedIn: boolean; source: string; operationId: string; noticeVersion?: string }) {
  if (!input.userId || !MARKETING_CHANNELS.includes(input.channel) || !input.operationId?.trim() || !input.source?.trim()) throw new PrivacyPreferenceError("INVALID_MARKETING_PREFERENCE");
  const auditReference = `NPA-${createHash("sha256").update(`${input.userId}:${input.channel}:${input.operationId}`).digest("hex").slice(0, 28)}`;
  return withSerializableRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`marketing:${input.userId}:${input.channel}`}))::text`);
    const replay = await tx.notificationAuditEvent.findUnique({ where: { publicReference: auditReference } });
    const records = await tx.notificationConsentRecord.findMany({ where: { userId: input.userId, channel: input.channel, purpose: "MARKETING" }, take: 2 });
    if (records.length > 1) throw new PrivacyPreferenceError("MARKETING_PREFERENCE_RECONCILIATION_REQUIRED");
    const eventType = input.optedIn ? "MARKETING_OPT_IN" : "MARKETING_OPT_OUT";
    if (replay) {
      if (replay.eventType !== eventType || replay.subjectUserId !== input.userId || replay.entityReference !== records[0]?.publicReference) throw new PrivacyPreferenceError("MARKETING_PREFERENCE_OPERATION_CONFLICT");
      const evidence = replay.safeEvidence;
      if (evidence && typeof evidence === "object" && !Array.isArray(evidence) && ((typeof evidence.source === "string" && evidence.source !== input.source) || (typeof evidence.noticeVersion === "string" && evidence.noticeVersion !== (input.noticeVersion ?? "MARKETING_PREFERENCE_V1")))) throw new PrivacyPreferenceError("MARKETING_PREFERENCE_OPERATION_CONFLICT");
      return records[0];
    }
    const now = new Date();
    const data = { status: input.optedIn ? "GRANTED" as const : "REVOKED" as const, source: input.source, noticeVersion: input.noticeVersion ?? "MARKETING_PREFERENCE_V1", grantedAt: input.optedIn ? now : null, revokedAt: input.optedIn ? null : now, actorUserId: input.userId, requestEvidence: { operationId: input.operationId, source: input.source } };
    const record = records[0] ? await tx.notificationConsentRecord.update({ where: { id: records[0].id }, data }) : await tx.notificationConsentRecord.create({ data: { publicReference: `MKT-${createHash("sha256").update(`${input.userId}:${input.channel}`).digest("hex").slice(0, 28)}`, userId: input.userId, channel: input.channel, purpose: "MARKETING", ...data } });
    await tx.notificationAuditEvent.create({ data: { publicReference: auditReference, actorUserId: input.userId, subjectUserId: input.userId, eventType, entityReference: record.publicReference, safeEvidence: { channel: input.channel, purpose: "MARKETING", operationId: input.operationId, source: input.source, noticeVersion: data.noticeVersion } } });
    return record;
  }, { isolationLevel: "ReadCommitted" }));
}

export async function getCookiePreference(input: { userId?: string | null; anonymousSubjectHash?: string | null; schemaVersion?: string }) {
  const schemaVersion = input.schemaVersion ?? COOKIE_SCHEMA_VERSION;
  if (!input.userId && !input.anonymousSubjectHash) return null;
  return (prisma as any).cookiePreference.findFirst({ where: { schemaVersion, ...(input.userId ? { userId: input.userId } : { anonymousSubjectHash: input.anonymousSubjectHash }) }, orderBy: { updatedAt: "desc" } });
}

export async function setCookiePreference(input: { userId?: string | null; anonymousSubjectHash?: string | null; state: CookiePreferenceState; source: string; operationId: string; schemaVersion?: string }) {
  if ((!input.userId && !input.anonymousSubjectHash) || (input.userId && input.anonymousSubjectHash)) throw new PrivacyPreferenceError("COOKIE_PREFERENCE_NOT_AUTHORIZED");
  if (!input.operationId?.trim() || !input.source?.trim() || !input.state || [input.state.functional, input.state.analytics, input.state.marketing].some(value => typeof value !== "boolean")) throw new PrivacyPreferenceError("COOKIE_PREFERENCE_INVALID");
  const schemaVersion = input.schemaVersion ?? COOKIE_SCHEMA_VERSION;
  if (schemaVersion !== COOKIE_SCHEMA_VERSION) throw new PrivacyPreferenceError("COOKIE_SCHEMA_VERSION_INVALID");
  return withSerializableRetry(() => prisma.$transaction(async tx => {
    const locks = [`cookie-operation:${input.operationId}`, `cookie-subject:${input.userId ? `user:${input.userId}` : `anonymous:${input.anonymousSubjectHash}`}:${schemaVersion}`].sort();
    for (const lock of locks) await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lock}))::text`);
    const replay = await tx.cookiePreferenceEvent.findUnique({ where: { operationId: input.operationId }, include: { preference: true } });
    if (replay) {
      const snapshot = replay.stateSnapshot;
      if (replay.preference.userId !== (input.userId ?? null) || replay.preference.anonymousSubjectHash !== (input.anonymousSubjectHash ?? null) || replay.source !== input.source || replay.schemaVersion !== schemaVersion || !snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) || snapshot.necessary !== true || snapshot.functional !== input.state.functional || snapshot.analytics !== input.state.analytics || snapshot.marketing !== input.state.marketing) throw new PrivacyPreferenceError("COOKIE_PREFERENCE_OPERATION_CONFLICT");
      return replay.preference;
    }
    const current = await tx.cookiePreference.findFirst({ where: { schemaVersion, ...(input.userId ? { userId: input.userId } : { anonymousSubjectHash: input.anonymousSubjectHash }) } });
    const data = { functional: input.state.functional, analytics: input.state.analytics, marketing: input.state.marketing, necessary: true, source: input.source };
    const preference = current ? await tx.cookiePreference.update({ where: { id: current.id }, data }) : await tx.cookiePreference.create({ data: { publicReference: ref("CKP"), userId: input.userId ?? null, anonymousSubjectHash: input.anonymousSubjectHash ?? null, schemaVersion, ...data } });
    await tx.cookiePreferenceEvent.create({ data: { cookiePreferenceId: preference.id, operationId: input.operationId, actorUserId: input.userId ?? null, source: input.source, schemaVersion, stateSnapshot: { necessary: true, ...input.state } } });
    if (input.userId) await tx.notificationAuditEvent.create({ data: { publicReference: ref("NPA"), actorUserId: input.userId, subjectUserId: input.userId, eventType: "COOKIE_PREFERENCE_UPDATED", entityReference: preference.publicReference, safeEvidence: { schemaVersion, functional: input.state.functional, analytics: input.state.analytics, marketing: input.state.marketing } } });
    return preference;
  }, { isolationLevel: "ReadCommitted" }));
}

export function safeCookiePreference(preference: any) { return preference ? { schemaVersion: preference.schemaVersion, necessary: true, functional: preference.functional, analytics: preference.analytics, marketing: preference.marketing, updatedAt: preference.updatedAt } : { schemaVersion: COOKIE_SCHEMA_VERSION, necessary: true, functional: false, analytics: false, marketing: false, updatedAt: null }; }
