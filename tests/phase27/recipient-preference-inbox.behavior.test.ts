import { describe, expect, it } from "vitest";
import { NotificationDigestService, NotificationEndpointService, NotificationInboxService, NotificationPreferenceService, NotificationRouteService, RecipientPolicyService, RECIPIENT_SUBJECTS, inQuietHours, isValidNotificationTimezone } from "@/lib/notifications/authority";
import { createNotificationMemoryDb } from "./helpers/in-memory-notification-db";

const transactional = { key: "ORDER_STATUS", purpose: "TRANSACTIONAL", mandatory: false, preferenceControlled: true, consentRequired: false, quietHoursBypass: false, digestEligible: true };
const security = { key: "ACCOUNT_SECURITY", purpose: "SECURITY", mandatory: true, preferenceControlled: false, consentRequired: false, quietHoursBypass: true, digestEligible: false };

describe("Phase 27 exact recipient resolution and privacy", () => {
  it("resolves every bounded subject through canonical active users and never an all-admin fallback", async () => {
    const users = RECIPIENT_SUBJECTS.map((subject, index) => ({ id: `user-${index}`, role: "ACTIVE_ROLE", status: "ACTIVE", email: `user-${index}@example.test`, emailVerifiedAt: new Date() }));
    const db = createNotificationMemoryDb({ user: users });
    const routes = new NotificationRouteService(db); const recipients = new RecipientPolicyService(db);
    const payload: Record<string, unknown> = { actorUserId: "user-0", customerUserId: "user-1", storeOwnerUserId: "user-2", storeStaffUserId: "user-3", driverUserId: "user-4", promoterUserId: "user-5", applicantUserId: "user-6", recruiterUserId: "user-7", hiringManagerUserId: "user-8", financeAdministratorUserId: "user-9", reconciliationAdministratorUserId: "user-10", securityAdministratorUserId: "user-11" };
    for (const [index, subject] of RECIPIENT_SUBJECTS.entries()) {
      const policy = await routes.createRecipientPolicyVersion({ key: `POLICY_${index}`, policy: { subject } });
      await routes.approveRecipientPolicy(policy.publicReference, "reviewer");
      await expect(recipients.resolve({ policyVersionId: policy.id, payload })).resolves.toMatchObject({ userId: `user-${index}`, roleProjection: subject, verifiedEmail: true });
    }
    expect(RECIPIENT_SUBJECTS).not.toContain("ALL_ADMINS" as never);
  });

  it("rejects missing, inactive, or wrong-role recipients instead of silently broadening access", async () => {
    const db = createNotificationMemoryDb({ user: [{ id: "customer", role: "CUSTOMER", status: "ACTIVE", email: "customer@example.test", emailVerifiedAt: new Date() }, { id: "inactive", role: "CUSTOMER", status: "SUSPENDED", email: "inactive@example.test", emailVerifiedAt: new Date() }] });
    const routes = new NotificationRouteService(db); const recipients = new RecipientPolicyService(db);
    const policy = await routes.createRecipientPolicyVersion({ key: "CUSTOMER_ONLY", policy: { subject: "CUSTOMER", role: "CUSTOMER" } }); await routes.approveRecipientPolicy(policy.publicReference, "reviewer");
    await expect(recipients.resolve({ policyVersionId: policy.id, payload: { customerUserId: "missing" } })).rejects.toMatchObject({ code: "RECIPIENT_NOT_RESOLVED" });
    await expect(recipients.resolve({ policyVersionId: policy.id, payload: { customerUserId: "inactive" } })).rejects.toMatchObject({ code: "RECIPIENT_NOT_RESOLVED" });
    db.__state.user[0].role = "PROMOTER";
    await expect(recipients.resolve({ policyVersionId: policy.id, payload: { customerUserId: "customer" } })).rejects.toMatchObject({ code: "RECIPIENT_NOT_RESOLVED" });
  });
});

describe("Phase 27 preference, quiet-hour, and digest policy", () => {
  it("applies mandatory, consent, channel opt-in, preference, suppression and verified-destination policy", async () => {
    const db = createNotificationMemoryDb(); const preferences = new NotificationPreferenceService(db);
    await expect(preferences.evaluate({ userId: "u1", category: transactional, channel: "IN_APP" })).resolves.toEqual({ state: "IMMEDIATE" });
    await expect(preferences.evaluate({ userId: "u1", category: transactional, channel: "SMS", verifiedDestination: true })).resolves.toEqual({ state: "BLOCKED", reason: "PREFERENCE_DISABLED" });
    await db.notificationPreference.create({ data: { userId: "u1", categoryKey: "ORDER_STATUS", channel: "SMS", mode: "ENABLED", digestMode: "IMMEDIATE" } });
    await expect(preferences.evaluate({ userId: "u1", category: transactional, channel: "SMS", verifiedDestination: true })).resolves.toEqual({ state: "IMMEDIATE" });
    await db.notificationPreference.update({ where: { userId_categoryKey_channel: { userId: "u1", categoryKey: "ORDER_STATUS", channel: "SMS" } }, data: { mode: "DISABLED" } });
    await expect(preferences.evaluate({ userId: "u1", category: transactional, channel: "SMS", verifiedDestination: true })).resolves.toEqual({ state: "BLOCKED", reason: "PREFERENCE_DISABLED" });
    await expect(preferences.evaluate({ userId: "u1", category: security, channel: "EMAIL", verifiedDestination: true })).resolves.toEqual({ state: "IMMEDIATE" });
    await expect(preferences.evaluate({ userId: "u1", category: { ...transactional, purpose: "MARKETING", consentRequired: true }, channel: "EMAIL", verifiedDestination: true })).resolves.toEqual({ state: "BLOCKED", reason: "CONSENT_REQUIRED" });
    await db.notificationConsentRecord.create({ data: { userId: "u1", channel: "EMAIL", purpose: "MARKETING", status: "GRANTED", noticeVersion: "notice-v1", source: "settings" } });
    await expect(preferences.evaluate({ userId: "u1", category: { ...transactional, purpose: "MARKETING", consentRequired: true }, channel: "EMAIL", verifiedDestination: true, suppressed: true })).resolves.toEqual({ state: "BLOCKED", reason: "SUPPRESSED_DESTINATION" });
  });

  it("uses strict South African fallback quiet windows, bounded day rules, and route-policy bypass only", async () => {
    const db = createNotificationMemoryDb(); const preferences = new NotificationPreferenceService(db);
    const lateInJohannesburg = new Date("2026-07-26T20:30:00.000Z");
    expect(isValidNotificationTimezone("Africa/Johannesburg")).toBe(true); expect(isValidNotificationTimezone("Mars/Olympus")).toBe(false);
    expect(inQuietHours("22:00", "06:00", lateInJohannesburg)).toBe(true);
    expect(inQuietHours("22:00", "06:00", lateInJohannesburg, "Africa/Johannesburg", [1])).toBe(false);
    expect(() => inQuietHours("99:00", "06:00", lateInJohannesburg)).toThrow("INVALID_NOTIFICATION_QUIET_HOURS");
    await db.notificationPreference.create({ data: { userId: "u1", categoryKey: "ORDER_STATUS", channel: "EMAIL", mode: "ENABLED", digestMode: "IMMEDIATE", quietHoursStart: "22:00", quietHoursEnd: "06:00", quietHoursDays: [], timezone: "Africa/Johannesburg" } });
    await expect(preferences.evaluate({ userId: "u1", category: transactional, channel: "EMAIL", verifiedDestination: true, at: lateInJohannesburg, routeQuietHoursBypass: true })).resolves.toEqual({ state: "QUEUED", reason: "QUIET_HOURS" });
    await expect(preferences.evaluate({ userId: "u1", category: security, channel: "EMAIL", verifiedDestination: true, at: lateInJohannesburg, routeQuietHoursBypass: true })).resolves.toEqual({ state: "IMMEDIATE" });
  });

  it("uses deterministic daily digest buckets and excludes mandatory, urgent, security, legal, and expired content", async () => {
    const db = createNotificationMemoryDb(); const digests = new NotificationDigestService(db); const scheduledAt = new Date("2026-07-27T06:00:00.000Z");
    const first = await digests.add({ userId: "u1", channel: "EMAIL", timezone: "Africa/Johannesburg", scheduledAt, messageId: "m1", category: transactional, priority: "NORMAL" });
    const replay = await digests.add({ userId: "u1", channel: "EMAIL", timezone: "Africa/Johannesburg", scheduledAt, messageId: "m1", category: transactional, priority: "NORMAL" });
    const second = await digests.add({ userId: "u1", channel: "EMAIL", timezone: "Africa/Johannesburg", scheduledAt, messageId: "m2", category: transactional, priority: "NORMAL" });
    expect(replay.id).toBe(first.id); expect(second.includedMessageIds).toEqual(["m1", "m2"]);
    for (const [category, priority, expiresAt] of [[security, "NORMAL", null], [{ ...transactional, purpose: "LEGAL", digestEligible: true }, "NORMAL", null], [transactional, "URGENT", null], [transactional, "NORMAL", new Date(Date.now() - 1)]] as any[]) await expect(digests.add({ userId: "u1", channel: "EMAIL", timezone: "Africa/Johannesburg", scheduledAt, messageId: crypto.randomUUID(), category, priority, expiresAt })).rejects.toMatchObject({ code: "NOTIFICATION_NOT_DIGEST_ELIGIBLE" });
  });
});

describe("Phase 27 inbox and endpoint ownership", () => {
  it("preserves inbox evidence while enforcing exact owner, expiry, and irreversible archive semantics", async () => {
    const db = createNotificationMemoryDb({ notificationInboxItem: [{ id: "inbox-1", publicReference: "inbox-one", messageId: "message-1", ownerUserId: "u1", title: "Title", body: "Body", state: "UNREAD", expiresAt: null, createdAt: new Date() }, { id: "inbox-old", publicReference: "inbox-old", messageId: "message-old", ownerUserId: "u1", title: "Old", body: "Old", state: "UNREAD", expiresAt: new Date(Date.now() - 1) }] }); const inbox = new NotificationInboxService(db);
    await expect(inbox.list("u1", 0, 10)).resolves.toMatchObject({ total: 1, items: [expect.objectContaining({ publicReference: "inbox-one" })] });
    await expect(inbox.unreadCount("u1")).resolves.toBe(1);
    await expect(inbox.changeState("u2", "inbox-one", "READ")).rejects.toMatchObject({ code: "NOTIFICATION_INBOX_ITEM_NOT_FOUND" });
    await inbox.changeState("u1", "inbox-one", "READ"); await inbox.changeState("u1", "inbox-one", "ARCHIVED");
    await expect(inbox.changeState("u1", "inbox-one", "UNREAD")).rejects.toMatchObject({ code: "NOTIFICATION_INBOX_ITEM_ARCHIVED" });
    await expect(inbox.changeState("u1", "inbox-old", "READ")).rejects.toMatchObject({ code: "NOTIFICATION_INBOX_ITEM_EXPIRED" });
    expect(db.__state.notificationInboxItem.find((item: any) => item.id === "inbox-1")).toMatchObject({ state: "ARCHIVED", archivedAt: expect.any(Date) });
  });

  it("marks stale endpoints and permits revocation only by their exact owner", async () => {
    const db = createNotificationMemoryDb({ notificationEndpoint: [{ id: "endpoint-1", publicReference: "endpoint-one", ownerUserId: "u1", status: "ACTIVE", fingerprint: "fp-1", encryptedEndpoint: "ciphertext", maskedDestination: "***" }] }); const endpoints = new NotificationEndpointService(db);
    await expect(endpoints.markStale("endpoint-1")).resolves.toMatchObject({ status: "STALE" });
    await expect(endpoints.revoke("u2", "endpoint-one")).rejects.toMatchObject({ code: "NOTIFICATION_ENDPOINT_NOT_FOUND" });
    await expect(endpoints.revoke("u1", "endpoint-one")).resolves.toMatchObject({ status: "REVOKED" });
  });
});
