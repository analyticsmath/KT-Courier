/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

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
  const auditReference = `NPA-${createHash("sha256").update(`${input.userId}:${input.channel}:${input.operationId}`).digest("hex").slice(0, 28)}`;
  const replay = await (prisma as any).notificationAuditEvent.findUnique({ where: { publicReference: auditReference } });
  if (replay) return (prisma as any).notificationConsentRecord.findFirst({ where: { userId: input.userId, channel: input.channel, purpose: "MARKETING" } });
  const current = await (prisma as any).notificationConsentRecord.findFirst({ where: { userId: input.userId, channel: input.channel, purpose: "MARKETING" } });
  const data = { status: input.optedIn ? "GRANTED" : "REVOKED", source: input.source, noticeVersion: input.noticeVersion ?? "MARKETING_PREFERENCE_V1", grantedAt: input.optedIn ? new Date() : null, revokedAt: input.optedIn ? null : new Date(), actorUserId: input.userId, requestEvidence: { operationId: input.operationId, source: input.source } };
  const record = current ? await (prisma as any).notificationConsentRecord.update({ where: { id: current.id }, data }) : await (prisma as any).notificationConsentRecord.create({ data: { publicReference: `MKT-${createHash("sha256").update(`${input.userId}:${input.channel}`).digest("hex").slice(0, 28)}`, userId: input.userId, channel: input.channel, purpose: "MARKETING", ...data } });
  await (prisma as any).notificationAuditEvent.create({ data: { publicReference: auditReference, actorUserId: input.userId, subjectUserId: input.userId, eventType: input.optedIn ? "MARKETING_OPT_IN" : "MARKETING_OPT_OUT", entityReference: record.publicReference, safeEvidence: { channel: input.channel, purpose: "MARKETING", operationId: input.operationId } } });
  return record;
}

export async function getCookiePreference(input: { userId?: string | null; anonymousSubjectHash?: string | null; schemaVersion?: string }) {
  const schemaVersion = input.schemaVersion ?? COOKIE_SCHEMA_VERSION;
  if (!input.userId && !input.anonymousSubjectHash) return null;
  return (prisma as any).cookiePreference.findFirst({ where: { schemaVersion, ...(input.userId ? { userId: input.userId } : { anonymousSubjectHash: input.anonymousSubjectHash }) }, orderBy: { updatedAt: "desc" } });
}

export async function setCookiePreference(input: { userId?: string | null; anonymousSubjectHash?: string | null; state: CookiePreferenceState; source: string; operationId: string; schemaVersion?: string }) {
  if ((!input.userId && !input.anonymousSubjectHash) || (input.userId && input.anonymousSubjectHash)) throw new PrivacyPreferenceError("COOKIE_PREFERENCE_NOT_AUTHORIZED");
  const schemaVersion = input.schemaVersion ?? COOKIE_SCHEMA_VERSION;
  if (schemaVersion !== COOKIE_SCHEMA_VERSION) throw new PrivacyPreferenceError("COOKIE_SCHEMA_VERSION_INVALID");
  const replay = await (prisma as any).cookiePreferenceEvent.findUnique({ where: { operationId: input.operationId }, include: { preference: true } });
  if (replay) return replay.preference;
  const current = await getCookiePreference({ userId: input.userId, anonymousSubjectHash: input.anonymousSubjectHash, schemaVersion });
  const data = { functional: input.state.functional, analytics: input.state.analytics, marketing: input.state.marketing, necessary: true, source: input.source };
  const preference = current ? await (prisma as any).cookiePreference.update({ where: { id: current.id }, data }) : await (prisma as any).cookiePreference.create({ data: { publicReference: ref("CKP"), userId: input.userId ?? null, anonymousSubjectHash: input.anonymousSubjectHash ?? null, schemaVersion, ...data } });
  try { await (prisma as any).cookiePreferenceEvent.create({ data: { cookiePreferenceId: preference.id, operationId: input.operationId, actorUserId: input.userId ?? null, source: input.source, schemaVersion, stateSnapshot: { necessary: true, ...input.state } } }); }
  catch (error) { if ((error as { code?: string }).code !== "P2002") throw error; }
  if (input.userId) await (prisma as any).notificationAuditEvent.create({ data: { publicReference: ref("NPA"), actorUserId: input.userId, subjectUserId: input.userId, eventType: "COOKIE_PREFERENCE_UPDATED", entityReference: preference.publicReference, safeEvidence: { schemaVersion, functional: input.state.functional, analytics: input.state.analytics, marketing: input.state.marketing } } });
  return preference;
}

export function safeCookiePreference(preference: any) { return preference ? { schemaVersion: preference.schemaVersion, necessary: true, functional: preference.functional, analytics: preference.analytics, marketing: preference.marketing, updatedAt: preference.updatedAt } : { schemaVersion: COOKIE_SCHEMA_VERSION, necessary: true, functional: false, analytics: false, marketing: false, updatedAt: null }; }
