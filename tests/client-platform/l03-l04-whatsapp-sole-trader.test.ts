import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreSellerIdentityForm } from "@/components/store/StoreSellerIdentityForm";
import { resolveLiveGatewayVerificationConfiguration } from "@/lib/payments/live-gateway-verification.service";
import {
  assertMarketplaceCheckoutProductionReady,
  evaluateMarketplaceCheckoutPublicGate,
} from "@/lib/marketplace-checkout/production-lock";
import { buildCapabilityMatrix } from "@/lib/production-readiness/capability-matrix.service";
import {
  assertCanonicalSellerEvidenceReference,
  StoreSellerIdentityProposalSchema,
  suggestSellerIdentityVersion,
} from "@/lib/validation/store-seller-identity";

const routeMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireSuperAdminApi: vi.fn(),
  enforceSameOriginRequest: vi.fn(),
  checkIpRateLimit: vi.fn(),
  hasPermission: vi.fn(),
  evaluateRetentionHolds: vi.fn(),
  mediaFindUnique: vi.fn(),
  createPublicQuote: vi.fn(),
  requestDeletion: vi.fn(),
  getMetadata: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: routeMocks.getCurrentUser }));
vi.mock("@/lib/auth/admin-api", () => ({ requireSuperAdminApi: routeMocks.requireSuperAdminApi }));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: routeMocks.hasPermission }));
vi.mock("@/lib/security/request-origin", () => ({ enforceSameOriginRequest: routeMocks.enforceSameOriginRequest }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkIpRateLimit: routeMocks.checkIpRateLimit,
  RATE_LIMITS: { PRIVATE_MEDIA_UPLOAD: {}, PAYMENT_STATUS: {} },
}));
vi.mock("@/lib/payments/customer-api-policy", async (orig) => ({
  ...await orig<typeof import("@/lib/payments/customer-api-policy")>(),
  checkIpRateLimit: routeMocks.checkIpRateLimit,
}));
vi.mock("@/lib/retention/hold-evaluator", () => ({ evaluateRetentionHolds: routeMocks.evaluateRetentionHolds }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    privateMediaObject: { findUnique: routeMocks.mediaFindUnique },
  },
}));
vi.mock("@/lib/private-media/private-media.service", async (orig) => {
  const actual = await orig<typeof import("@/lib/private-media/private-media.service")>();
  return {
    ...actual,
    PrivateMediaService: class {
      getMetadata = routeMocks.getMetadata;
      requestDeletion = routeMocks.requestDeletion;
    },
  };
});
vi.mock("@/lib/client-platform/delivery.service", async (orig) => ({
  ...await orig<typeof import("@/lib/client-platform/delivery.service")>(),
  createPublicQuote: routeMocks.createPublicQuote,
}));
vi.mock("@/lib/client-platform/api", async (orig) => ({
  ...await orig<typeof import("@/lib/client-platform/api")>(),
  mutation: async (req: NextRequest) => ({ body: await req.json() }),
}));

import { GET as getLiveVerification } from "@/app/api/admin/payment-providers/live-verification/route";
import { POST as postPublicQuote } from "@/app/api/public/delivery-quotes/route";
import { DELETE as deletePrivateMedia } from "@/app/api/private-media/[reference]/route";
import { PrivateMediaPolicyError } from "@/lib/private-media/private-media.service";
import { PlatformError } from "@/lib/client-platform/contracts";

const envBackup = { ...process.env };

beforeEach(() => {
  vi.resetAllMocks();
  routeMocks.enforceSameOriginRequest.mockResolvedValue(null);
  routeMocks.checkIpRateLimit.mockResolvedValue({ ok: true });
  routeMocks.hasPermission.mockResolvedValue(false);
  routeMocks.evaluateRetentionHolds.mockResolvedValue({ hasHold: false, holdCount: 0 });
  routeMocks.mediaFindUnique.mockResolvedValue({ ownerType: "USER", ownerId: "owner-1" });
});

afterEach(() => {
  process.env = { ...envBackup };
});

describe("L-03 Paystack R1 live-verification boundary", () => {
  it("denies non-superadmin callers and reports ineligible when sandbox/non-live flags exist", async () => {
    routeMocks.requireSuperAdminApi.mockResolvedValue({
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    });
    const denied = await getLiveVerification(new NextRequest("https://ktcouriers.com/api/admin/payment-providers/live-verification"));
    expect(denied.status).toBe(403);

    const sandboxConfig = resolveLiveGatewayVerificationConfiguration({
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      PAYSTACK_MODE: "test",
      PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true",
      PAYSTACK_SECRET_KEY: "sk_test_123",
      PAYSTACK_PUBLIC_KEY: "pk_test_123",
      PAYMENT_APP_ORIGIN: "https://ktcouriers.com",
    });
    expect(sandboxConfig.eligible).toBe(false);

    const liveConfig = resolveLiveGatewayVerificationConfiguration({
      NODE_ENV: "production",
      KT_DATABASE_CLASSIFICATION: "production",
      PAYSTACK_MODE: "live",
      PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "false",
      PAYSTACK_SECRET_KEY: "sk_live_example_only",
      PAYSTACK_PUBLIC_KEY: "pk_live_example_only",
      PAYMENT_APP_ORIGIN: "https://www.ktcouriers.com",
    });
    expect(liveConfig).toMatchObject({
      eligible: true,
      secretKey: "sk_live_example_only",
      origin: "https://www.ktcouriers.com",
    });
  });
});

describe("L-04 checkout production-lock and readiness capability diagnostics", () => {
  it("reports exact CHECKOUT_PUBLIC_DISABLED and Paystack sandbox blockers when gated off", () => {
    const publicGate = evaluateMarketplaceCheckoutPublicGate({
      NODE_ENV: "production",
      CHECKOUT_PUBLIC_ENABLED: "false",
    });
    expect(publicGate).toMatchObject({ enabled: false, blockReason: "CHECKOUT_PUBLIC_DISABLED" });
    expect(() => assertMarketplaceCheckoutProductionReady("PAYMENT", undefined, {
      NODE_ENV: "production",
      CHECKOUT_PUBLIC_ENABLED: "true",
      PAYSTACK_MODE: "live",
      PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true",
    })).toThrow();

    const matrix = buildCapabilityMatrix({
      now: new Date(),
      releaseSha: "a".repeat(40),
      capabilities: [],
      paystack: {
        mode: "live",
        temporarySandboxActive: true,
        sandboxExpiresAt: null,
        sandboxStatus: "TEMPORARY_SANDBOX",
        checkoutReady: false,
        eftReady: false,
        checkoutBlockers: ["PAYSTACK_TEMPORARY_SANDBOX_ACTIVE"],
        eftBlockers: ["PAYSTACK_TEMPORARY_SANDBOX_ACTIVE"],
        configuredMode: "live",
        callbackOriginConfigured: true,
        publicKeyConfigured: true,
        secretKeyConfigured: true,
        webhookSecretConfigured: true,
      } as never,
      acceptanceRecords: [],
      env: {
        NODE_ENV: "production",
        KT_DATABASE_CLASSIFICATION: "production",
        CHECKOUT_PUBLIC_ENABLED: "false",
      },
    });
    const publicCheckoutRow = matrix.find((entry) => entry.key === "STORE_CHECKOUT");
    expect(publicCheckoutRow).toMatchObject({
      sourceImplemented: true,
      eligibleForLiveUse: false,
    });
    expect(publicCheckoutRow?.lastBlockerCode).toBeTruthy();
  });
});

describe("Nov 5 WhatsApp regression and Sole-Trader PAMMY_BAKES_V1 validation", () => {
  it("distinguishes unresolved address (422) from coverage unavailable (409) on public quotes", async () => {
    routeMocks.getCurrentUser.mockResolvedValue(null);
    const body = {
      serviceKey: "CLIENT_ECONOMY",
      parcelSize: "SMALL",
      weightKg: "1.5",
      pickupAddress: { line1: "12 Oxford Rd", suburb: "Rosebank", city: "Johannesburg", province: "Gauteng" },
      dropoffAddress: { line1: "200 Burnett St", suburb: "Hatfield", city: "Pretoria", province: "Gauteng" },
    };

    routeMocks.createPublicQuote.mockRejectedValueOnce(new PlatformError("ADDRESS_UNRESOLVED", "Select a mapped entrance.", 422));
    const unresolved = await postPublicQuote(new NextRequest("https://ktcouriers.com/api/public/delivery-quotes", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(unresolved.status).toBe(422);
    expect(await unresolved.json()).toMatchObject({ code: "ADDRESS_UNRESOLVED" });

    routeMocks.createPublicQuote.mockRejectedValueOnce(new PlatformError("COVERAGE_UNAVAILABLE", "Outside active province.", 409));
    const outOfArea = await postPublicQuote(new NextRequest("https://ktcouriers.com/api/public/delivery-quotes", {
      method: "POST",
      body: JSON.stringify(body),
    }));
    expect(outOfArea.status).toBe(409);
    expect(await outOfArea.json()).toMatchObject({ code: "COVERAGE_UNAVAILABLE" });
  });

  it("validates PAMMY_BAKES_V1 unregistered sole-trader form rules and rejects raw PammyBakes tokens", () => {
    const html = renderToStaticMarkup(createElement(StoreSellerIdentityForm, { currentReference: null }));
    expect(html).toContain("PAMMY_BAKES_V1");
    expect(suggestSellerIdentityVersion("Pammy Bakes")).toBe("PAMMY_BAKES_V1");

    const validProposal = StoreSellerIdentityProposalSchema.safeParse({
      operationId: "op-pammy-001",
      expectedIdentityReference: null,
      identityVersion: "PAMMY_BAKES_V1",
      legalName: "Pamela Example Owner",
      tradingName: "Pammy Bakes",
      vatRegistrationStatus: "NOT_REGISTERED",
      registrationReference: null,
      vatNumber: null,
      countryCode: "ZA",
      invoiceClassification: "RECEIPT",
      effectiveFrom: "2026-11-16T10:00:00Z",
      effectiveUntil: null,
      termsReference: null,
      sourceEvidenceReference: "PMO-11111111-1111-4111-8111-111111111111",
      confirmSuppliedDetails: true,
    });
    expect(validProposal.success).toBe(true);
    if (!validProposal.success) throw new Error("Expected PAMMY_BAKES_V1 proposal to be valid.");

    const spaceVersion = StoreSellerIdentityProposalSchema.safeParse({
      ...validProposal.data,
      identityVersion: "Pammy Bakes",
    });
    expect(spaceVersion.success).toBe(false);

    expect(() => assertCanonicalSellerEvidenceReference("PammyBakes")).toThrow();
  });
});

describe("Protected media DELETE /api/private-media/[reference]", () => {
  const ctx = { params: Promise.resolve({ reference: "PMO-TEST-REF" }) };

  it("enforces authentication, ownership, retention holds, deposit financial holds, and authorized deletion", async () => {
    routeMocks.getCurrentUser.mockResolvedValueOnce(null);
    expect((await deletePrivateMedia(new NextRequest("https://ktcouriers.com/api/private-media/PMO-TEST-REF", { method: "DELETE" }), ctx)).status).toBe(401);

    routeMocks.getCurrentUser.mockResolvedValue({ id: "owner-1", role: "CUSTOMER", status: "ACTIVE" });
    routeMocks.evaluateRetentionHolds.mockResolvedValueOnce({ hasHold: true, holdCount: 1, activeHoldReason: "DISPUTE_HOLD" });
    expect((await deletePrivateMedia(new NextRequest("https://ktcouriers.com/api/private-media/PMO-TEST-REF", { method: "DELETE" }), ctx)).status).toBe(409);

    routeMocks.requestDeletion.mockRejectedValueOnce(new PrivateMediaPolicyError("DEPOSIT_PROOF_FINANCIAL_HOLD", 409, "Deposit proof held."));
    expect((await deletePrivateMedia(new NextRequest("https://ktcouriers.com/api/private-media/PMO-TEST-REF", { method: "DELETE" }), ctx)).status).toBe(409);

    routeMocks.requestDeletion.mockRejectedValueOnce(new PrivateMediaPolicyError("PRIVATE_MEDIA_FORBIDDEN", 403, "Forbidden."));
    expect((await deletePrivateMedia(new NextRequest("https://ktcouriers.com/api/private-media/PMO-TEST-REF", { method: "DELETE" }), ctx)).status).toBe(403);

    routeMocks.requestDeletion.mockResolvedValueOnce({ publicReference: "PMO-TEST-REF", status: "DELETED" });
    const ok = await deletePrivateMedia(new NextRequest("https://ktcouriers.com/api/private-media/PMO-TEST-REF", { method: "DELETE" }), ctx);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ media: { publicReference: "PMO-TEST-REF", status: "DELETED" } });
  });
});
