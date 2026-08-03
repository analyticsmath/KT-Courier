import { createHmac, timingSafeEqual } from "node:crypto";

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "SMS", "WEB_PUSH", "ANDROID_PUSH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationPurpose = "SECURITY" | "LEGAL" | "TRANSACTIONAL" | "OPERATIONAL" | "SERVICE_ANNOUNCEMENT" | "MARKETING";
export type NotificationSensitivity = "PUBLIC" | "ACCOUNT" | "FINANCIAL" | "SECURITY" | "RESTRICTED";
export type PreferenceMode = "ENABLED" | "DISABLED" | "MANDATORY" | "CONSENT_REQUIRED";
export type ConsentStatus = "NOT_REQUESTED" | "REQUESTED" | "GRANTED" | "REVOKED" | "EXPIRED";
export type FailureClass = "TRANSIENT_NETWORK" | "PROVIDER_RATE_LIMIT" | "PROVIDER_UNAVAILABLE" | "INVALID_DESTINATION" | "AUTHENTICATION_FAILURE" | "CONFIGURATION_FAILURE" | "CONTENT_REJECTED" | "PERMISSION_DENIED" | "CONSENT_REQUIRED" | "SUPPRESSED_DESTINATION" | "EXPIRED_MESSAGE" | "UNKNOWN_PROVIDER_FAILURE";

export class NotificationPolicyError extends Error {
  constructor(readonly code: string, message = code) { super(message); this.name = "NotificationPolicyError"; }
}

export const EXTERNAL_CHANNELS = new Set<NotificationChannel>(["EMAIL", "SMS", "WEB_PUSH", "ANDROID_PUSH"]);
export const RETRYABLE_FAILURES = new Set<FailureClass>(["TRANSIENT_NETWORK", "PROVIDER_RATE_LIMIT", "PROVIDER_UNAVAILABLE", "UNKNOWN_PROVIDER_FAILURE"]);

export function isSafeInternalRoute(value: string | undefined): boolean {
  return Boolean(value && /^\/(?!\/)[A-Za-z0-9/_?=&%.-]{1,512}$/.test(value) && !value.includes(".."));
}

export function assertSafeActionRoute(value: string | undefined): void {
  if (value !== undefined && !isSafeInternalRoute(value)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
}

export function assertNotificationContent(input: { sensitivity: NotificationSensitivity; channel: NotificationChannel; actionRoute?: string; body: string }): void {
  assertSafeActionRoute(input.actionRoute);
  const maximumLength = input.channel === "SMS" ? 1_600 : input.channel === "WEB_PUSH" || input.channel === "ANDROID_PUSH" ? 512 : 16_000;
  if (input.body.length > maximumLength || /<script\b|javascript:|\beval\s*\(|\bnew\s+Function\b/i.test(input.body)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  if (input.sensitivity === "RESTRICTED" && EXTERNAL_CHANNELS.has(input.channel) && input.body !== "An action is required in your KT Couriers account.") {
    throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  }
}

export function deliveryEligible(input: { purpose: NotificationPurpose; channel: NotificationChannel; preference?: PreferenceMode; consent?: ConsentStatus; suppressed?: boolean; verifiedDestination?: boolean }): { eligible: boolean; reason?: string } {
  if (input.channel === "IN_APP") return { eligible: true };
  if (input.suppressed) return { eligible: false, reason: "SUPPRESSED_DESTINATION" };
  if (!input.verifiedDestination) return { eligible: false, reason: "VERIFIED_NOTIFICATION_DESTINATION_REQUIRED" };
  if (input.purpose === "MARKETING" && input.consent !== "GRANTED") return { eligible: false, reason: "CONSENT_REQUIRED" };
  if (input.purpose !== "SECURITY" && input.purpose !== "LEGAL" && input.preference === "DISABLED") return { eligible: false, reason: "PREFERENCE_DISABLED" };
  return { eligible: true };
}

export function nextRetryAt(input: { failure: FailureClass; attemptNumber: number; now?: Date; retryAfterSeconds?: number; expiresAt?: Date | null }): Date | null {
  if (!RETRYABLE_FAILURES.has(input.failure) || input.attemptNumber >= 5) return null;
  const now = input.now ?? new Date();
  const seconds = Math.min(3600, input.retryAfterSeconds ?? (30 * 2 ** (input.attemptNumber - 1)));
  const retry = new Date(now.getTime() + seconds * 1000);
  return input.expiresAt && retry >= input.expiresAt ? null : retry;
}

function b64(value: string) { return Buffer.from(value).toString("base64url"); }
function unb64(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }

/** Opaque, channel-bound, single-purpose unsubscribe token. */
export function signMarketingUnsubscribe(input: { subjectId: string; channel: Exclude<NotificationChannel, "IN_APP">; expiresAt: Date }, secret: string): string {
  const payload = b64(JSON.stringify({ v: 1, p: "MARKETING_UNSUBSCRIBE", s: input.subjectId, c: input.channel, e: input.expiresAt.toISOString() }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyMarketingUnsubscribe(token: string, secret: string): { subjectId: string; channel: Exclude<NotificationChannel, "IN_APP"> } {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new NotificationPolicyError("INVALID_UNSUBSCRIBE_TOKEN");
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new NotificationPolicyError("INVALID_UNSUBSCRIBE_TOKEN");
  let parsed: { v: number; p: string; s: string; c: NotificationChannel; e: string };
  try { parsed = JSON.parse(unb64(payload)); } catch { throw new NotificationPolicyError("INVALID_UNSUBSCRIBE_TOKEN"); }
  if (parsed.v !== 1 || parsed.p !== "MARKETING_UNSUBSCRIBE" || parsed.c === "IN_APP" || !parsed.s || new Date(parsed.e).getTime() <= Date.now()) throw new NotificationPolicyError("INVALID_UNSUBSCRIBE_TOKEN");
  return { subjectId: parsed.s, channel: parsed.c };
}
