import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { createRefundRequest, cancelRefundRequest } from "../../lib/services/refund-request.service";
import { beginRefundReview, approveRefund } from "../../lib/services/refund-finance-review.service";
import { completeRefundToCustomerWallet } from "../../lib/services/refund-wallet-completion.service";
import { startProviderRefund, finalizeProviderRefundAttempt } from "../../lib/services/refund-provider-execution.service";
import { queryRefundProviderStatus, pollAndApplyRefundProviderStatus } from "../../lib/services/refund-reconciliation.service";
import { withCanonicalBrowser } from "./marketplace-canonical-support";
import { canonicalRefundSource, protectedRefundState, refundOperation, assertJournalMoney } from "./refund-canonical-support";

describe("signed Paystack source → canonical refund PostgreSQL authority", () => {
  it("reserves partial amounts atomically, denies actor/hash replay, completes exact wallet credit and conserves the cumulative paid ceiling", async () => {
    await withCanonicalBrowser(async page => {
      const f = await canonicalRefundSource(page, "pg-refund-wallet");
      const request = { actorUserId: f.owner, paymentPublicReference: f.payment.publicReference, amount: "25.00", method: "CUSTOMER_WALLET" as const, reasonCode: "CUSTOMER_SERVICE_RESOLUTION" as const, operationId: refundOperation("wallet-request") };
      await expect(createRefundRequest(request)).rejects.toMatchObject({ code: "REFUND_PRODUCTION_NOT_READY" });
      const refund = await createRefundRequest(request, f.dependencies);
      let state = await protectedRefundState(f.payment.id);
      assertJournalMoney(state.refunds[0].reserveLedgerJournal, "REFUND_RESERVE", "25.00");
      expect(state.payment.totalRefundReservedAmount.toFixed(2)).toBe("25.00");
      const frozen = state;
      expect((await createRefundRequest(request, f.dependencies)).id).toBe(refund.id);
      await expect(createRefundRequest({ ...request, amount: "26.00" }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_IDEMPOTENCY_CONFLICT" });
      await expect(createRefundRequest({ ...request, actorUserId: f.foreign.id }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_IDEMPOTENCY_CONFLICT" });
      await expect(cancelRefundRequest({ actorUserId: f.foreign.id, publicReference: refund.publicReference, operationId: refundOperation("foreign-cancel") })).rejects.toMatchObject({ code: "REFUND_FORBIDDEN" });
      await expect(beginRefundReview({ actorUserId: f.owner, publicReference: refund.publicReference, operationId: refundOperation("self-review") })).rejects.toMatchObject({ code: "REFUND_DUAL_CONTROL_REQUIRED" });
      expect(await protectedRefundState(f.payment.id)).toEqual(frozen);
      await beginRefundReview({ actorUserId: f.approver.id, publicReference: refund.publicReference, operationId: refundOperation("review") });
      await approveRefund({ actorUserId: f.approver.id, publicReference: refund.publicReference, operationId: refundOperation("approve") });
      const completion = { actorUserId: f.processor.id, publicReference: refund.publicReference, operationId: refundOperation("wallet-complete") };
      await expect(completeRefundToCustomerWallet({ ...completion, actorUserId: f.approver.id }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_DUAL_CONTROL_REQUIRED" });
      await expect(completeRefundToCustomerWallet(completion)).rejects.toMatchObject({ code: "REFUND_PRODUCTION_NOT_READY" });
      await Promise.all([completeRefundToCustomerWallet(completion, f.dependencies), completeRefundToCustomerWallet(completion, f.dependencies)]);
      state = await protectedRefundState(f.payment.id);
      assertJournalMoney(state.refunds[0].completionLedgerJournal, "REFUND_WALLET_CREDIT", "25.00");
      expect(state.payment.totalRefundedAmount.toFixed(2)).toBe("25.00");
      expect(state.payment.totalRefundReservedAmount.toFixed(2)).toBe("0.00");
      expect(await prisma.refundStatusHistory.count({ where: { refundId: refund.id, operationId: completion.operationId } })).toBe(1);
      const remaining = f.payment.amount.sub(25).toFixed(2);
      const race = await Promise.allSettled([0, 1].map(() => createRefundRequest({ ...request, amount: remaining, operationId: refundOperation("remaining-race") }, f.dependencies)));
      expect(race.filter(r => r.status === "fulfilled")).toHaveLength(1);
      const loser = race.find(r => r.status === "rejected") as PromiseRejectedResult;
      expect(loser.reason).toMatchObject({ code: "REFUND_AMOUNT_EXCEEDS_REMAINING" });
      const winner = (race.find(r => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof createRefundRequest>>>).value;
      await approveRefund({ actorUserId: f.approver.id, publicReference: winner.publicReference, operationId: refundOperation("remainder-approve") });
      await completeRefundToCustomerWallet({ actorUserId: f.processor.id, publicReference: winner.publicReference, operationId: refundOperation("remainder-complete") }, f.dependencies);
      const final = await protectedRefundState(f.payment.id);
      expect(final.payment.status).toBe("SUCCEEDED"); expect(final.payment.totalRefundedAmount.equals(f.payment.amount)).toBe(true); expect(final.payment.totalRefundReservedAmount.isZero()).toBe(true);
      expect(final.refunds).toHaveLength(2); expect(final.journals).toHaveLength(4);
      const wallet = await prisma.ledgerAccount.findFirstOrThrow({ where: { purpose: "CUSTOMER_WALLET_AVAILABLE", wallet: { ownerId: f.owner, ownerType: "CUSTOMER" } } });
      expect(wallet.currentBalance.equals(f.payment.amount)).toBe(true);
      await expect(createRefundRequest({ ...request, amount: "0.01", operationId: refundOperation("over-paid-ceiling") }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_AMOUNT_EXCEEDS_REMAINING" });
      expect(await protectedRefundState(f.payment.id)).toEqual(final);
    });
  }, 180_000);

  it("definitively failed partial provider attempts retain reserves, retry once with a new operation, and replay success without another provider call", async () => {
    await withCanonicalBrowser(async page => {
      const f = await canonicalRefundSource(page, "pg-refund-failed");
      const refund = await createRefundRequest({ actorUserId: f.owner, paymentPublicReference: f.payment.publicReference, amount: "10.01", method: "ORIGINAL_PAYMENT_METHOD", reasonCode: "SERVICE_NOT_PROVIDED", operationId: refundOperation("provider-request") }, f.dependencies);
      await approveRefund({ actorUserId: f.approver.id, publicReference: refund.publicReference, operationId: refundOperation("provider-approve") });
      f.client.outcome = "failed";
      const failedOperation = { actorUserId: f.processor.id, publicReference: refund.publicReference, operationId: refundOperation("provider-failed") };
      await startProviderRefund(failedOperation, f.dependencies);
      let state = await protectedRefundState(f.payment.id);
      expect(state.refunds[0].status).toBe("APPROVED"); expect(state.refunds[0].attempts[0].status).toBe("FAILED");
      expect(state.payment.totalRefundReservedAmount.toFixed(2)).toBe("10.01"); expect(state.refunds[0].completionLedgerJournal).toBeNull();
      expect((await startProviderRefund(failedOperation, f.dependencies)).status).toBe("APPROVED"); expect(f.client.calls).toBe(1);
      f.client.outcome = "processed";
      const successOperation = { ...failedOperation, operationId: refundOperation("provider-retry") };
      await startProviderRefund(successOperation, f.dependencies);
      state = await protectedRefundState(f.payment.id);
      expect(state.refunds[0].status).toBe("SUCCEEDED"); expect(state.refunds[0].attempts.map(a => a.status)).toEqual(["FAILED", "SUCCEEDED"]);
      assertJournalMoney(state.refunds[0].completionLedgerJournal, "REFUND_EXTERNAL_PAYOUT", "10.01");
      expect(state.payment.totalRefundedAmount.toFixed(2)).toBe("10.01"); expect(state.payment.totalRefundReservedAmount.isZero()).toBe(true);
      expect((await startProviderRefund(successOperation, f.dependencies)).status).toBe("SUCCEEDED"); expect(f.client.calls).toBe(2);
      await expect(startProviderRefund({ ...successOperation, actorUserId: f.foreign.id }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_IDEMPOTENCY_CONFLICT" });
      expect(await protectedRefundState(f.payment.id)).toEqual(state);
    });
  }, 180_000);

  for (const outcome of ["pending", "needs-attention", "unrecognized", "network-loss", "rate-limit", "wrong-amount", "wrong-currency", "wrong-reference"] as const) {
    it(`${outcome} cannot release a canonical partial reservation or post a payout without verified processed facts`, async () => {
      await withCanonicalBrowser(async page => {
        const f = await canonicalRefundSource(page, `pg-refund-${outcome === "unrecognized" ? "unknown" : outcome}`);
        const refund = await createRefundRequest({ actorUserId: f.owner, paymentPublicReference: f.payment.publicReference, amount: "10.01", method: "ORIGINAL_PAYMENT_METHOD", reasonCode: "SERVICE_NOT_PROVIDED", operationId: refundOperation("uncertain-request") }, f.dependencies);
        await approveRefund({ actorUserId: f.approver.id, publicReference: refund.publicReference, operationId: refundOperation("uncertain-approve") });
        const before = await protectedRefundState(f.payment.id);
        const operation = { actorUserId: f.processor.id, publicReference: refund.publicReference, operationId: refundOperation("uncertain-start") };
        f.client.outcome = outcome;
        await expect(startProviderRefund(operation)).rejects.toMatchObject({ code: "REFUND_PRODUCTION_NOT_READY" });
        expect(f.client.calls).toBe(0);
        await startProviderRefund(operation, f.dependencies);
        const uncertain = await protectedRefundState(f.payment.id);
        expect(uncertain.payment.totalRefundReservedAmount.toFixed(2)).toBe("10.01"); expect(uncertain.payment.totalRefundedAmount.isZero()).toBe(true);
        expect(uncertain.refunds[0].completionLedgerJournal).toBeNull(); expect(uncertain.accounts).toEqual(before.accounts);
        expect(uncertain.journals).toHaveLength(1); expect(f.client.calls).toBe(1);
        expect((await startProviderRefund(operation, f.dependencies)).id).toBe(refund.id); expect(f.client.calls).toBe(1);
        await expect(startProviderRefund({ ...operation, operationId: refundOperation("forbidden-uncertain-retry") }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_INVALID_STATE" });
        expect(f.client.calls).toBe(1);
        if (outcome === "pending") {
          expect(uncertain.refunds[0].status).toBe("PROCESSING"); expect(uncertain.refunds[0].attempts[0].status).toBe("PROCESSING");
          await expect(pollAndApplyRefundProviderStatus({ attemptId: uncertain.refunds[0].attempts[0].id, actorUserId: f.processor.id }, { registry: f.registry })).rejects.toMatchObject({ code: "REFUND_PRODUCTION_NOT_READY" });
          f.client.outcome = "processed";
          expect(await pollAndApplyRefundProviderStatus({ attemptId: uncertain.refunds[0].attempts[0].id, actorUserId: f.processor.id }, f.dependencies)).toMatchObject({ polled: true, applied: true, status: "SUCCEEDED" });
        } else {
          expect(uncertain.refunds[0].status).toBe("RECONCILIATION_REQUIRED"); expect(uncertain.refunds[0].reconciliationCases).toHaveLength(1);
          if (outcome === "needs-attention" || outcome === "unrecognized") {
            const query = { actorUserId: f.processor.id, refundId: refund.id, operationId: refundOperation("uncertain-query") };
            f.client.outcome = "query-loss";
            await queryRefundProviderStatus(query, f.dependencies);
            expect((await protectedRefundState(f.payment.id)).accounts).toEqual(before.accounts);
            f.client.outcome = "wrong-amount";
            await expect(queryRefundProviderStatus({ ...query, operationId: refundOperation("wrong-query") }, f.dependencies)).rejects.toMatchObject({ code: "REFUND_PROVIDER_RESPONSE_INVALID" });
            expect((await protectedRefundState(f.payment.id)).accounts).toEqual(before.accounts);
            f.client.outcome = "processed";
            await queryRefundProviderStatus({ ...query, operationId: refundOperation("processed-query") }, f.dependencies);
          } else {
            // A lost create response has no reviewed provider reference. Query
            // cannot infer the fixture's accepted id or authorize a new create.
            await queryRefundProviderStatus({ actorUserId: f.processor.id, refundId: refund.id, operationId: refundOperation("unavailable-query") }, f.dependencies);
            const unresolved = await protectedRefundState(f.payment.id);
            expect(unresolved.refunds[0].status).toBe("RECONCILIATION_REQUIRED"); expect(unresolved.refunds[0].reconciliationCases.map(c => c.reason)).toContain("PROVIDER_QUERY_UNAVAILABLE");
            expect(unresolved.accounts).toEqual(before.accounts); expect(f.client.queries).toBe(0);
            return;
          }
        }
        const final = await protectedRefundState(f.payment.id);
        expect(final.refunds[0].status).toBe("SUCCEEDED"); assertJournalMoney(final.refunds[0].completionLedgerJournal, "REFUND_EXTERNAL_PAYOUT", "10.01");
        expect(final.payment.totalRefundReservedAmount.isZero()).toBe(true); expect(final.payment.totalRefundedAmount.toFixed(2)).toBe("10.01");
        const attempt = final.refunds[0].attempts[0]; const facts = { status: "SUCCEEDED" as const, providerRefundId: attempt.providerRefundId!, providerPaymentId: attempt.providerPaymentId!, amount: "10.01", currency: "ZAR", definitive: true };
        await finalizeProviderRefundAttempt({ actorUserId: f.processor.id, refundPublicReference: refund.publicReference, attemptPublicReference: attempt.publicReference, result: facts });
        expect(await protectedRefundState(f.payment.id)).toEqual(final);
      });
    }, 180_000);
  }
});
