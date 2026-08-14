import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/types/db";
import { deliveryEligible } from "@/lib/notifications/contracts";
import { getCookiePreference, getMarketingPreferences, hashAnonymousCookieSubject, setCookiePreference, setMarketingPreference } from "@/lib/privacy/preference.service";

const marker = `PPP${randomUUID().replaceAll("-", "").toUpperCase()}`;
let userA = ""; let userB = "";
beforeAll(async () => { await prisma.$queryRaw`SELECT 1`; const [a, b] = await Promise.all([prisma.user.create({ data: { email: `${marker.toLowerCase()}-a@example.test`, passwordHash: "phase-b-test-only", name: "Preference A", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } }), prisma.user.create({ data: { email: `${marker.toLowerCase()}-b@example.test`, passwordHash: "phase-b-test-only", name: "Preference B", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE } })]); userA = a.id; userB = b.id; });

describe("Phase B marketing and cookie preference PostgreSQL production-service proof", () => {
  it("enforces marketing opt-out without suppressing required communication and preserves separate cookie evidence", async () => {
    await setMarketingPreference({ userId: userA, channel: "EMAIL", optedIn: true, source: "POSTGRES_PROOF", operationId: `${marker}-MARKETING-IN` });
    await setMarketingPreference({ userId: userA, channel: "EMAIL", optedIn: false, source: "POSTGRES_PROOF", operationId: `${marker}-MARKETING-OUT` });
    await setMarketingPreference({ userId: userA, channel: "EMAIL", optedIn: false, source: "POSTGRES_PROOF", operationId: `${marker}-MARKETING-OUT` });
    expect((await getMarketingPreferences(userA)).find((item) => item.channel === "EMAIL")?.status).toBe("REVOKED");
    expect(deliveryEligible({ purpose: "MARKETING", channel: "EMAIL", consent: "REVOKED", verifiedDestination: true })).toEqual({ eligible: false, reason: "USER_OPTED_OUT" });
    expect(deliveryEligible({ purpose: "SECURITY", channel: "EMAIL", consent: "REVOKED", verifiedDestination: true }).eligible).toBe(true);
    expect(deliveryEligible({ purpose: "TRANSACTIONAL", channel: "EMAIL", consent: "REVOKED", verifiedDestination: true }).eligible).toBe(true);
    expect(deliveryEligible({ purpose: "OPERATIONAL", channel: "EMAIL", consent: "REVOKED", verifiedDestination: true }).eligible).toBe(true);
    await setCookiePreference({ userId: userA, state: { functional: true, analytics: true, marketing: true }, source: "POSTGRES_PROOF", operationId: `${marker}-COOKIE-ALLOW` });
    await setCookiePreference({ userId: userA, state: { functional: false, analytics: false, marketing: false }, source: "POSTGRES_PROOF", operationId: `${marker}-COOKIE-WITHDRAW` });
    expect((await getCookiePreference({ userId: userA }))?.marketing).toBe(false);
    expect((await getCookiePreference({ anonymousSubjectHash: hashAnonymousCookieSubject(marker) }))).toBeNull();
    expect(await (prisma as any).cookiePreferenceEvent.count({ where: { preference: { userId: userA } } })).toBe(2);
    expect(await (prisma as any).notificationConsentRecord.count({ where: { userId: userB } })).toBe(0);
  });
});
