/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/payments/paystack/webhook/route";
import { calculatePaystackHmac } from "@/lib/payments/providers/paystack/paystack-signature";
import {
  ingestPaystackWebhook,
  claimPaystackWebhookEventsBatch,
  processClaimedPaystackWebhookEvent,
} from "@/lib/services/paystack-webhook-application.service";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => {
  const mockPrisma: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(),
    paymentWebhookEvent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    paymentAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentStatusHistory: {
      create: vi.fn(),
    },
    paymentVerifiedEventIntent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    notificationEventIntent: {
      upsert: vi.fn(),
    },
    withdrawalPayoutAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    withdrawalRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    withdrawalStatusHistory: {
      create: vi.fn(),
    },
    withdrawalReconciliationCase: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    refundExecutionAttempt: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    paymentRefund: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentDispute: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ledgerAccount: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    ledgerJournal: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    wallet: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    cashOnDelivery: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe("Phase 1: Paystack Durable Webhook Inbox & Worker Delivery", () => {
  const testSecret = "sk_test_mock_webhook_secret_key_12345";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PAYSTACK_SECRET_KEY = testSecret;
  });

  describe("HTTP Ingress Route Boundary", () => {
    it("rejects webhooks with missing x-paystack-signature header (401)", async () => {
      const req = new NextRequest("https://api.ktcouriers.test/api/payments/paystack/webhook", {
        method: "POST",
        body: JSON.stringify({ event: "charge.success", data: {} }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Missing x-paystack-signature");
      expect(prisma.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
    });

    it("rejects webhooks with invalid HMAC signature (401)", async () => {
      const body = JSON.stringify({ event: "charge.success", data: { id: 101, reference: "ref_101" } });
      const req = new NextRequest("https://api.ktcouriers.test/api/payments/paystack/webhook", {
        method: "POST",
        headers: {
          "x-paystack-signature": "invalid_hex_signature_string",
          "content-type": "application/json",
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(prisma.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
    });

    it("rejects oversized request bodies exceeding 1MB limit (413)", async () => {
      const largeData = "x".repeat(1_048_577);
      const req = new NextRequest("https://api.ktcouriers.test/api/payments/paystack/webhook", {
        method: "POST",
        headers: {
          "x-paystack-signature": "any_signature",
          "content-type": "application/json",
        },
        body: largeData,
      });

      const res = await POST(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error).toContain("exceeds size limit");
    });

    it("persists valid webhook into durable inbox with 200 OK without executing business logic", async () => {
      const payload = {
        event: "charge.success",
        data: {
          id: 998877,
          reference: "attempt_ref_999",
          amount: 50000,
          currency: "ZAR",
          status: "success",
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = calculatePaystackHmac(rawBody, testSecret);

      (prisma.paymentWebhookEvent.findUnique as any).mockResolvedValue(null);
      (prisma.paymentWebhookEvent.upsert as any).mockResolvedValue({
        id: "pwe_id_123",
        publicReference: "pwe_ref_123",
        processingStatus: "RECEIVED",
      });

      const req = new NextRequest("https://api.ktcouriers.test/api/payments/paystack/webhook", {
        method: "POST",
        headers: {
          "x-paystack-signature": signature,
          "content-type": "application/json",
        },
        body: rawBody,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
      expect(json.eventPublicReference).toBe("pwe_ref_123");

      // Verify DB upsert was called with RECEIVED
      expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            provider: "PAYSTACK",
            processingStatus: "RECEIVED",
            attemptCount: 0,
            signatureVerified: true,
          }),
        }),
      );

      // Verify NO payment settlement transaction was executed in the HTTP route
      expect(prisma.paymentAttempt.update).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe("Durable Ingestion & Fingerprinting", () => {
    it("recognizes duplicate webhooks and avoids double-inserting", async () => {
      const payload = {
        event: "charge.success",
        data: { id: 12345, reference: "ref_abc", amount: 10000, currency: "ZAR", status: "success" },
      };
      const rawBody = JSON.stringify(payload);
      const signature = calculatePaystackHmac(rawBody, testSecret);

      (prisma.paymentWebhookEvent.findUnique as any).mockResolvedValue({
        id: "pwe_existing",
        publicReference: "pwe_pub_existing",
        processingStatus: "APPLIED",
      });

      const result = await ingestPaystackWebhook({
        rawBody,
        signature,
        secretKey: testSecret,
      });

      expect(result.received).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(result.webhookEventId).toBe("pwe_existing");
      expect(prisma.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
    });

    it("generates distinct fingerprints for different lifecycle events on the same target", async () => {
      const transferPending = {
        event: "transfer.pending",
        data: { id: 777, reference: "kt_wpa_001", status: "pending" },
      };
      const transferSuccess = {
        event: "transfer.success",
        data: { id: 777, reference: "kt_wpa_001", status: "success" },
      };

      (prisma.paymentWebhookEvent.findUnique as any).mockResolvedValue(null);
      (prisma.paymentWebhookEvent.upsert as any).mockImplementation((args: any) => ({
        id: "pwe_id",
        publicReference: "pwe_ref",
        processingStatus: "RECEIVED",
        eventFingerprint: args.where.eventFingerprint,
      }));

      const res1 = await ingestPaystackWebhook({
        rawBody: JSON.stringify(transferPending),
        signature: calculatePaystackHmac(JSON.stringify(transferPending), testSecret),
        secretKey: testSecret,
      });

      const res2 = await ingestPaystackWebhook({
        rawBody: JSON.stringify(transferSuccess),
        signature: calculatePaystackHmac(JSON.stringify(transferSuccess), testSecret),
        secretKey: testSecret,
      });

      expect(res1.event).toBe("transfer.pending");
      expect(res2.event).toBe("transfer.success");
      // Distinct fingerprints allow lifecycle transitions through unique constraints
      expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe("Inbox Batch Lease Claiming Pattern", () => {
    it("claims pending RECEIVED rows with a lease token and lease expiration", async () => {
      (prisma.$queryRaw as any).mockResolvedValue([{ id: "pwe_1" }, { id: "pwe_2" }]);
      (prisma.paymentWebhookEvent.findMany as any).mockResolvedValue([
        { id: "pwe_1", publicReference: "ref_1", processingStatus: "PROCESSING", attemptCount: 1 },
        { id: "pwe_2", publicReference: "ref_2", processingStatus: "PROCESSING", attemptCount: 1 },
      ]);

      const claimed = await claimPaystackWebhookEventsBatch({ batchSize: 10, leaseDurationMs: 30_000 });

      expect(claimed).toHaveLength(2);
      expect(claimed[0].leaseToken).toBeDefined();
      expect(prisma.paymentWebhookEvent.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ["pwe_1", "pwe_2"] } },
          data: expect.objectContaining({
            processingStatus: "PROCESSING",
            attemptCount: { increment: 1 },
          }),
        }),
      );
    });

    it("re-claims stalled events when their lease has expired", async () => {
      (prisma.$queryRaw as any).mockImplementation((query: any) => {
        const sqlText = typeof query === "object" && query.sql ? query.sql : String(query);
        expect(sqlText).toContain("FOR UPDATE SKIP LOCKED");
        expect(sqlText).toContain("leaseExpiresAt");
        return [{ id: "pwe_expired_lease" }];
      });
      (prisma.paymentWebhookEvent.findMany as any).mockResolvedValue([
        { id: "pwe_expired_lease", publicReference: "ref_exp", processingStatus: "PROCESSING", attemptCount: 2 },
      ]);

      const claimed = await claimPaystackWebhookEventsBatch({ batchSize: 5 });
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe("pwe_expired_lease");
    });
  });

  describe("Event Dispatching & Transitions", () => {
    it("transitions unsupported signed events to IGNORED_UNSUPPORTED without failing", async () => {
      const event = {
        id: "pwe_unsupported",
        publicReference: "pwe_ref_unsupported",
        provider: "PAYSTACK",
        processingStatus: "PROCESSING",
        eventFingerprint: "paystack:unknown.event:123",
        safePayloadSnapshot: { event: "dedicatedaccount.assign.success", data: { id: 123 } },
        attemptCount: 1,
        leaseToken: "lease_token_123",
      };

      const result = await processClaimedPaystackWebhookEvent(event);
      expect(result.outcome).toBe("IGNORED_UNSUPPORTED");

      expect(prisma.paymentWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: { id: "pwe_unsupported", leaseToken: "lease_token_123" },
        data: expect.objectContaining({
          processingStatus: "IGNORED_UNSUPPORTED",
          leaseToken: null,
          leaseExpiresAt: null,
        }),
      });
    });

    it("dispatches transfer.failed and marks event APPLIED", async () => {
      (prisma.withdrawalPayoutAttempt.findUnique as any).mockResolvedValue({
        id: "wpa_1",
        publicReference: "WPA-001",
        status: "PROCESSING",
        externalReference: "kt_wpa_001",
        withdrawal: {
          id: "wd_1",
          publicReference: "WTH-001",
          status: "PROCESSING",
          amount: new Prisma.Decimal("100.00"),
        },
      });

      const event = {
        id: "pwe_transfer_failed",
        publicReference: "pwe_ref_tf",
        provider: "PAYSTACK",
        processingStatus: "PROCESSING",
        eventFingerprint: "paystack:transfer.failed:kt_wpa_001:failed",
        safePayloadSnapshot: {
          event: "transfer.failed",
          data: { reference: "kt_wpa_001", reason: "Account number invalid", status: "failed" },
        },
        attemptCount: 1,
        leaseToken: "lease_token_456",
      };

      const result = await processClaimedPaystackWebhookEvent(event);
      expect(result.outcome).toBe("APPLIED");

      // Verify attempt marked FAILED and withdrawal returned to APPROVED
      expect(prisma.withdrawalPayoutAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wpa_1" },
          data: expect.objectContaining({ status: "FAILED" }),
        }),
      );
      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "wd_1" },
          data: expect.objectContaining({ status: "APPROVED" }),
        }),
      );

      // Verify event finalized with null lease
      expect(prisma.paymentWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: { id: "pwe_transfer_failed", leaseToken: "lease_token_456" },
        data: expect.objectContaining({
          processingStatus: "APPLIED",
          leaseToken: null,
          leaseExpiresAt: null,
        }),
      });
    });

    it("schedules exponential backoff on transient processing failure", async () => {
      const event = {
        id: "pwe_error_event",
        publicReference: "pwe_ref_err",
        provider: "PAYSTACK",
        processingStatus: "PROCESSING",
        eventFingerprint: "paystack:charge.success:fail:1",
        safePayloadSnapshot: { event: "charge.success", data: { reference: "non_existent" } },
        attemptCount: 3,
        leaseToken: "lease_err_token",
      };

      // Mock applyPaystackWebhookEvent error by rejecting attempt lookup
      (prisma.paymentAttempt.findUnique as any).mockRejectedValue(new Error("Database connection lost"));

      await expect(processClaimedPaystackWebhookEvent(event)).rejects.toThrow();

      // Verify backoff scheduled and lease released
      expect(prisma.paymentWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: { id: "pwe_error_event", leaseToken: "lease_err_token" },
        data: expect.objectContaining({
          processingStatus: "RECEIVED",
          nextAttemptAt: expect.any(Date),
          leaseToken: null,
          leaseExpiresAt: null,
        }),
      });
    });
  });
});
