import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { safePromoterRow } from "@/lib/promoters/api-policy";
import { parsePromoterCommand } from "@/lib/promoters/route-support";

const root = process.cwd();
const routes = [
  "app/api/promoter/route.ts", "app/api/promoter/profile/route.ts", "app/api/promoter/compliance/route.ts", "app/api/promoter/programs/route.ts", "app/api/promoter/programs/[reference]/route.ts", "app/api/promoter/programs/[reference]/enroll/route.ts", "app/api/promoter/channels/route.ts", "app/api/promoter/referral-codes/route.ts", "app/api/promoter/referral-codes/[reference]/archive/route.ts", "app/api/promoter/referrals/route.ts", "app/api/promoter/referrals/[reference]/route.ts", "app/api/promoter/earnings/route.ts", "app/api/promoter/earnings/[reference]/route.ts", "app/api/promoter/wallet/route.ts", "app/api/promoter/withdrawals/route.ts", "app/api/promoter/performance/route.ts", "app/api/promoter/assets/route.ts", "app/api/promoter/disputes/route.ts",
];
const contents = routes.map((file) => readFileSync(join(root, file), "utf8"));

describe("Phase 25 promoter API composition", () => {
  it("has the complete promoter route surface", () => expect(routes.every((file) => existsSync(join(root, file)))).toBe(true));
  it("requires authentication and the correct self-service permission", () => expect(contents.every((content) => /requirePromoter(?:Read|Mutation)\(/.test(content) && /PERMISSIONS\.PROMOTER_/.test(content))).toBe(true));
  it("locks promoter mutations and applies request validation", () => {
    const mutations = contents.filter((content) => /requirePromoterMutation/.test(content));
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every((content) => /parsePromoterCommand|z\.object/.test(content))).toBe(true);
    expect(readFileSync(join(root, "lib/promoters/api-policy.ts"), "utf8")).toMatch(/PROMOTERS_PRODUCTION_VALIDATION_APPROVED/);
  });
  it("projects only the authenticated promoter's records", () => {
    const collectionRoutes = contents.filter((content) => /(?:promoterAttribution|promoterEarning|promoterChannel|promoterReferralCode|withdrawalRequest).*findMany/.test(content));
    expect(collectionRoutes.every((content) => /promoterAccountId: auth\.account\.id|ownerId: auth\.account\.id/.test(content))).toBe(true);
  });
  it("removes customer identity, payment, code secrets, and financial evidence from DTOs", () => {
    const row = safePromoterRow({ publicReference: "PAT-1", legalName: "private", customerUserId: "customer", paymentId: "payment", codeHmac: "hmac", safeEvidence: { email: "customer@example.com" }, walletId: "wallet", status: "ATTRIBUTED" });
    expect(row).toEqual({ publicReference: "PAT-1", walletId: "wallet", status: "ATTRIBUTED" });
    expect(JSON.stringify(contents)).not.toMatch(/customerEmail|customerPhone|customerName|streetAddress/);
  });
  it("validates commands strictly and rejects unknown fields", async () => {
    const schema = z.object({ operationId: z.string().min(8) });
    const invalid = await parsePromoterCommand(new Request("http://localhost", { method: "POST", body: JSON.stringify({ operationId: "phase25-1", unexpected: true }) }), schema);
    expect(invalid).toBeInstanceOf(Response);
    const valid = await parsePromoterCommand(new Request("http://localhost", { method: "POST", body: JSON.stringify({ operationId: "phase25-1" }) }), schema);
    expect(valid).toEqual({ operationId: "phase25-1" });
  });
  it("exposes no promoter-controlled financial mutation endpoint", () => {
    expect(JSON.stringify(contents)).not.toMatch(/manualWallet|manualLedger|wallet\.update|ledger\.post|completePayout|balance/);
  });
});
