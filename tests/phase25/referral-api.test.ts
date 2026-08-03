import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fingerprintPromoterCode,
  hmacPromoterCode,
  maskPromoterCode,
  normalizePromoterCode,
  signPromoterReferralToken,
  verifyPromoterReferralToken,
} from "@/lib/promoters/code-security";
import { PromoterError } from "@/lib/promoters/errors";

const root = process.cwd();
const referralSource = [
  "app/api/referrals/code/resolve/route.ts",
  "app/api/referrals/attribution/bind/route.ts",
  "app/r/[opaqueCode]/page.tsx",
].map((file) => readFileSync(join(root, file), "utf8")).join("\n");

beforeEach(() => { process.env.PROMOTER_REFERRAL_HMAC_SECRET = "phase25-test-secret-which-is-at-least-32-bytes"; });

describe("Phase 25 referral code and token security", () => {
  it("normalizes codes before lookup and keeps a safe masked display", () => {
    expect(normalizePromoterCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(hmacPromoterCode("abcd-2345")).toBe(hmacPromoterCode("ABCD2345"));
    expect(fingerprintPromoterCode("abcd-2345")).not.toBe("ABCD2345");
    expect(maskPromoterCode("ABCD2345")).toBe("ABC…345");
  });
  it("rejects invalid code formats without exposing lookup details", () => expect(() => normalizePromoterCode("short")).toThrow(PromoterError));
  it("signs tokens with references only", () => {
    const token = signPromoterReferralToken({ touchReference: "PTC-1", programVersionReference: "PPV-1", enrollmentReference: "PEN-1", destinationType: "CUSTOMER_REGISTRATION" });
    const verified = verifyPromoterReferralToken(token);
    expect(verified.touchReference).toBe("PTC-1");
    expect(token).not.toMatch(/customer@example|wallet|commission|payment|phone/i);
  });
  it("rejects invalid signatures", () => {
    const token = signPromoterReferralToken({ touchReference: "PTC-1", programVersionReference: "PPV-1", enrollmentReference: "PEN-1", destinationType: "CUSTOMER_REGISTRATION" });
    try { verifyPromoterReferralToken(`${token}tampered`); } catch (error) { expect((error as PromoterError).code).toBe("PROMOTER_TOKEN_INVALID"); return; }
    throw new Error("Invalid signature was accepted.");
  });
  it("rejects expired tokens", () => {
    const token = signPromoterReferralToken({ touchReference: "PTC-1", programVersionReference: "PPV-1", enrollmentReference: "PEN-1", destinationType: "CUSTOMER_REGISTRATION" }, -1);
    try { verifyPromoterReferralToken(token); } catch (error) { expect((error as PromoterError).code).toBe("PROMOTER_TOKEN_EXPIRED"); return; }
    throw new Error("Expired token was accepted.");
  });
  it("fails closed when the signing secret is absent", () => {
    delete process.env.PROMOTER_REFERRAL_HMAC_SECRET;
    try { hmacPromoterCode("ABCD2345"); } catch (error) { expect((error as PromoterError).code).toBe("PROMOTER_TOKEN_INVALID"); return; }
    throw new Error("Missing signing secret was accepted.");
  });
});

describe("Phase 25 referral route composition", () => {
  it("accepts only opaque codes and falls back to signup", () => {
    expect(referralSource).toMatch(/normalizePromoterCode/);
    expect(referralSource).toMatch(/redirect\("\/signup"\)/);
    expect(referralSource).toMatch(/promoter_token/);
  });
  it("keeps the successful token redirect outside the fallback catch", () => {
    expect(referralSource).toMatch(/let destination = "\/signup"/);
    expect(referralSource).toMatch(/destination = `\/signup\?promoter_token=/);
    expect(referralSource).toMatch(/}\s*catch \{ redirect\("\/signup"\); \}[\s\S]*redirect\(destination\);/);
  });
  it("creates a safe touch and signed token", () => {
    expect(referralSource).toMatch(/recordPromoterTouch/);
    expect(referralSource).toMatch(/createSignedReferralToken/);
    expect(referralSource).toMatch(/CUSTOMER_REGISTRATION/);
  });
  it("rejects external, protocol-relative, JavaScript, and unsupported destinations by composition", () => {
    expect(referralSource).toMatch(/assertInternalDestination|CUSTOMER_REGISTRATION/);
    expect(referralSource).toMatch(/verifyPromoterReferralToken/);
    expect(readFileSync(join(root, "lib/promoters/policy.ts"), "utf8")).toMatch(/BUSINESS_REGISTRATION/);
    expect(readFileSync(join(root, "lib/promoters/policy.ts"), "utf8")).toMatch(/CUSTOMER_REGISTRATION\|STORE_APPLICATION/);
  });
  it("represents existing customer/store and post-registration rejection in canonical binding", () => {
    const binding = readFileSync(join(root, "lib/promoters/qualification-earning.service.ts"), "utf8");
    expect(binding).toMatch(/subjectCreatedAt/);
    expect(binding).toMatch(/Existing subjects cannot be attributed/);
    expect(binding).toMatch(/touch\.occurredAt > input\.subjectCreatedAt/);
  });
});
