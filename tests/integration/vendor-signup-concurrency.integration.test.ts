import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { verifyAccountEmail } from "@/lib/services/account-email-verification.service";
vi.mock("@/lib/security/rate-limit", async original => ({ ...await original<typeof import("@/lib/security/rate-limit")>(), checkIpRateLimit: vi.fn(async () => ({ ok: true })) }));
// Widen the real read/create race without fabricating a slug or database result.
// A serialized implementation still observes the first committed store.
vi.mock("@/lib/utils/slug", async original => {
  const actual = await original<typeof import("@/lib/utils/slug")>(); let reads = 0;
  let release!: () => void; const bothRead = new Promise<void>(resolve => { release = resolve; });
  return { ...actual, generateUniqueSlug: (base: string, exists: (slug: string) => Promise<boolean>) => actual.generateUniqueSlug(base, async slug => {
    const found = await exists(slug);
    if (++reads === 2) release();
    if (reads <= 2) await Promise.race([bothRead, new Promise(resolve => setTimeout(resolve, 100))]);
    return found;
  }) };
});
import { POST } from "@/app/api/auth/signup/route";

describe("new vendor registration concurrency", () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("registers two owners with the same store name and keeps both stores pending review", async () => {
    const tag = randomUUID(); const name = `Synthetic shared vendor ${tag}`;
    const emails = [`signup-first-${tag}@example.test`, `signup-second-${tag}@example.test`];
    const requests = emails.map(email => new NextRequest("http://localhost:3000/api/auth/signup", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ accountType: "STORE", storeName: name, contactPerson: "Synthetic owner", email, phone: "0821112233", password: "DisposableSignup123!", confirmPassword: "DisposableSignup123!" }) }));
    const results = await Promise.all(requests.map(request => POST(request)));
    expect(results.map(result => result.status)).toEqual([201, 201]);
    const stores = await prisma.store.findMany({ where: { ownerUser: { email: { in: emails } } }, include: { ownerUser: true } });
    expect(stores).toHaveLength(2); expect(new Set(stores.map(store => store.slug)).size).toBe(2);
    expect(stores.every(store => store.status === "PENDING" && store.ownerUser?.status === "PENDING_VERIFICATION")).toBe(true);
    expect(await prisma.otpCode.count({ where: { email: { in: emails }, purpose: "EMAIL_VERIFICATION", consumedAt: null } })).toBe(2);
  });
  it("does not reveal account existence or status through bad verification responses", async () => {
    const tag = randomUUID(); const unknown = await verifyAccountEmail(`unknown-${tag}@example.test`, "888888");
    for (const status of ["ACTIVE", "PENDING_VERIFICATION", "SUSPENDED", "DISABLED"] as const) {
      const user = await prisma.user.create({ data: { email: `verification-${status}-${tag}@example.test`, role: "CUSTOMER", status } });
      expect(await verifyAccountEmail(user.email, "888888")).toEqual(unknown);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe(status);
    }
    expect(unknown).toMatchObject({ ok: false, status: 400 });
  });
});
