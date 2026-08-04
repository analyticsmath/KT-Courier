import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertExactlyOneAttributionSubject,
  assertInternalDestination,
  assertPromoterTargetAvailable,
  BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE,
} from "@/lib/promoters/policy";
import { PromoterError } from "@/lib/promoters/errors";

const root = process.cwd();
const sourceRoots = ["lib/promoters", "app/api/promoter", "app/api/referrals", "app/r", "components/promoters", "scripts"];
function sourceFiles(directory: string): string[] {
  const absolute = join(root, directory);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const file = join(absolute, entry.name);
    return entry.isDirectory() ? sourceFiles(join(directory, entry.name)) : /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [file] : [];
  });
}
const phase25Source = () => sourceRoots.flatMap(sourceFiles).filter((file) => !file.includes("audit-")).map((file) => readFileSync(file, "utf8")).join("\n");

describe("Phase 25 commercial and legal policy", () => {
  const forbiddenProductConcepts: Array<[string, RegExp]> = [
    ["customer refer-a-friend reward", /customer.{0,40}(?:refer.?a.?friend|referral).{0,80}(?:reward|credit)/i],
    ["customer wallet referral credit", /(?:wallet|credit).{0,60}(?:customer|consumer).{0,60}referr/i],
    ["promoter purchase or joining fee", /promoter.{0,80}(?:purchase|joining fee|investment requirement)/i],
    ["downline", /\bdownline\b/i],
    ["promoter recruitment commission", /promoter.{0,80}(?:recruitment|recruiting).{0,80}commission/i],
    ["lifetime downstream commission", /lifetime.{0,60}downstream.{0,60}commission/i],
    ["direct-message delivery", /(?:send|deliver|upload).{0,60}(?:email|sms|whatsapp|push|direct message).{0,60}(?:customer|marketing)/i],
  ];
  for (const [name, pattern] of forbiddenProductConcepts) it(`has no ${name}`, () => expect(phase25Source()).not.toMatch(pattern));
  it("requires paid-promotion disclosure vocabulary in the trusted asset policy", () => expect(phase25Source()).toMatch(/Ad|Sponsored|Paid promotion|Promoter link/));
  it("does not define a BusinessAccount Prisma aggregate", () => expect(readFileSync(join(root, "prisma/schema.prisma"), "utf8")).not.toMatch(/model\s+BusinessAccount\b/));
});

describe("Phase 25 business-customer boundary", () => {
  for (const operation of ["creation", "approval", "activation"]) {
    it(`fails closed for business program ${operation}`, () => {
      try { assertPromoterTargetAvailable("BUSINESS_CUSTOMER"); } catch (error) { expect((error as PromoterError).code).toBe(BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE); return; }
      throw new Error("Business acquisition did not fail closed.");
    });
  }
  for (const destination of ["BUSINESS_REGISTRATION", "https://example.com", "//example.com", "javascript:alert(1)", "UNSUPPORTED_DESTINATION"]) {
    it(`rejects ${destination} as a referral destination`, () => expect(() => assertInternalDestination(destination)).toThrow(PromoterError));
  }
  it("uses the stable business-unavailable reason code", () => {
    try { assertPromoterTargetAvailable("BUSINESS_CUSTOMER"); } catch (error) { expect((error as PromoterError).code).toBe(BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE); }
  });
  it("requires exactly one acquisition subject", () => {
    expect(() => assertExactlyOneAttributionSubject({})).toThrow();
    expect(() => assertExactlyOneAttributionSubject({ customerUserId: "c", storeId: "s" })).toThrow();
    expect(() => assertExactlyOneAttributionSubject({ customerUserId: "c" })).not.toThrow();
  });
});

describe("Phase 25 production safety policy", () => {
  it("contains no Phase 26 recruitment behavior", () => expect(phase25Source()).not.toMatch(/(?:recruit|downline|upline).{0,80}(?:commission|bonus|invite)/i));
  it("contains no customer contact-list upload or marketing sender", () => expect(phase25Source()).not.toMatch(/(?:contact.?list|sendEmail|sendSms|sendWhatsApp|sendPush|customerContact)/i));
});
