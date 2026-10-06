import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { loadPublishedPolicy, publicPolicyDefinitions, type PublicPolicyId } from "@/lib/public-legal/published-policy";

const enabled = process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" && new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent").pathname === "/kt_launch_test";
describe.skipIf(!enabled)("reviewed client initialization on isolated PostgreSQL", () => {
  it("publishes the actual canonical policies and confirmed tariff once, leaving parcel examples as drafts", async () => {
    await prisma.user.create({ data: { email: "reviewed-admin@example.test", role: "SUPER_ADMIN", status: "ACTIVE" } });
    const execute = (script: string) => execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", script], { env: process.env, timeout: 60_000, stdio: "pipe" });
    execute("scripts/initialize-client-delivery.ts");
    execute("scripts/initialize-reviewed-client-launch.ts");
    const company = await prisma.companyProfileVersion.findMany();
    expect(company).toHaveLength(1);
    expect(company[0].registrationNumber).toBe("2024/475266/07");
    const profiles = await prisma.parcelProfileVersion.findMany();
    expect(profiles).toHaveLength(3);
    expect(profiles.every((p) => p.status === "DRAFT")).toBe(true);
    const express = await prisma.deliveryServiceDefinition.findMany({ where: { stableKey: "CLIENT_EXPRESS" }, orderBy: { versionNumber: "asc" } });
    expect(express).toHaveLength(2);
    expect(express[1].status).toBe("ACTIVE");
    expect(express[1].pricingPolicy).toMatchObject({ tariffs: { SMALL: { baseFee: "5.50", perKmRate: "5.50" }, MEDIUM: { baseFee: "8.50", perKmRate: "5.50" }, LARGE: { baseFee: "13.00", perKmRate: "5.50" } } });
    const before = await prisma.legalDocumentVersion.findMany({ orderBy: { id: "asc" } });
    expect(before).toHaveLength(4);
    for (const id of Object.keys(publicPolicyDefinitions) as PublicPolicyId[]) {
      const policy = await loadPublishedPolicy(id);
      expect(policy?.version).toBe("2026-10-06-client-v1");
      expect(policy?.content.length).toBeGreaterThan(1000);
    }
    execute("scripts/initialize-reviewed-client-launch.ts");
    expect(await prisma.legalDocumentVersion.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expect(await prisma.companyProfileVersion.count()).toBe(1);
    expect(await prisma.parcelProfileVersion.count()).toBe(3);
    expect(await prisma.deliveryServiceDefinition.count({ where: { stableKey: "CLIENT_EXPRESS" } })).toBe(2);
  }, 120_000);
});
