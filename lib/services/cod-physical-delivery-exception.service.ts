import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { withLedgerRetry } from "@/lib/ledger/retry";
import { recordAdminAlertIntentInTx } from "@/lib/notifications/admin-alert-dispatch.service";
import { sanitizeLogContext } from "@/lib/observability/logger";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import type { AuthenticatedUser } from "@/types/domain";

export class CodPhysicalDeliveryExceptionError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
const PENDING = "PHYSICAL_DELIVERY_REVIEW_PENDING";
const VERIFIED = "PHYSICAL_DELIVERY_VERIFIED";
export const COD_UNCOLLECTED_RECEIVABLE_ACCOUNT_CODE = "PLATFORM-COD-UNCOLLECTED-RECEIVABLE-ZAR";
export const COD_UNCOLLECTED_SUSPENSE_ACCOUNT_CODE = "PLATFORM-COD-UNCOLLECTED-SHORTAGE-SUSPENSE-ZAR";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function ensureShortageReceivableAccounts(tx: Prisma.TransactionClient) {
  const chartSetting = await tx.systemSetting?.findUnique?.({
    where: { key: "cod.shortage_receivable_accounting_enabled" },
    select: { type: true, value: true },
  }).catch(() => null);
  if (chartSetting && chartSetting.value === false) {
    throw new CodPhysicalDeliveryExceptionError(
      "SHORTAGE_ACCOUNTING_CONFIGURATION_MISSING",
      "Finance chart-of-accounts mapping for uncollected COD shortage receivable/suspense is disabled.",
    );
  }
  const platformWallet = await ensureWalletForOwner(
    { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" },
    tx,
  );
  const [receivableAccount, suspenseAccount] = await Promise.all([
    ensureLedgerAccount(
      {
        walletId: platformWallet.id,
        code: COD_UNCOLLECTED_RECEIVABLE_ACCOUNT_CODE,
        purpose: "COD_UNCOLLECTED_RECEIVABLE",
        category: "ASSET",
        currency: "ZAR",
      },
      tx,
    ),
    ensureLedgerAccount(
      {
        walletId: platformWallet.id,
        code: COD_UNCOLLECTED_SUSPENSE_ACCOUNT_CODE,
        purpose: "COD_UNCOLLECTED_SUSPENSE",
        category: "LIABILITY",
        currency: "ZAR",
      },
      tx,
    ),
  ]);
  if (
    receivableAccount.status !== "ACTIVE" ||
    suspenseAccount.status !== "ACTIVE" ||
    receivableAccount.category !== "ASSET" ||
    suspenseAccount.category !== "LIABILITY"
  ) {
    throw new CodPhysicalDeliveryExceptionError(
      "SHORTAGE_ACCOUNTING_CONFIGURATION_MISSING",
      "Uncollected COD shortage receivable and suspense accounts must be ACTIVE ASSET/LIABILITY accounts.",
    );
  }
  return { receivableAccount, suspenseAccount };
}

async function authorize(actor: AuthenticatedUser, operational: boolean) {
  if (actor.status !== "ACTIVE" || !["ADMIN", "SUPER_ADMIN"].includes(actor.role) ||
      !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.COD_OPERATIONS_MANAGE }) ||
      (operational && !await hasPermission({ userId: actor.id, role: actor.role, permissionKey: PERMISSIONS.ORDERS_STATUS_MANAGE }))) {
    throw new CodPhysicalDeliveryExceptionError("FORBIDDEN", "Cash operations authority is required.");
  }
}
function validate(input: { operationId: string; reason: string }) {
  if (!/^[A-Za-z0-9:_-]{8,120}$/.test(input.operationId) || !input.reason.trim() || input.reason.trim().length > 1000)
    throw new CodPhysicalDeliveryExceptionError("INVALID_INPUT", "A valid operation reference and reason are required.");
}
function response(status: string, cod: { cashObligation: Prisma.Decimal; cashCollected: Prisma.Decimal }) {
  return { status, cashOutstanding: Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), 0).toFixed(2) };
}

async function assertOrderEvidence(tx: Prisma.TransactionClient, orderId: string, reference: string | undefined) {
  if (!reference || reference.length > 160) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Order-owned private delivery evidence is required.");
  const proof = await tx.deliveryProofEvidence.findFirst({ where: { publicReference: reference, orderId, status: "READY", privateVisibility: true, validatedAt: { not: null }, assignment: { status: "ACCEPTED" } }, select: { storageReference: true, driverProfileId: true, assignment: { select: { driverProfileId: true } } } });
  const media = proof && await tx.privateMediaObject.findFirst({ where: { publicReference: proof.storageReference, ownerType: "PROOF_OF_DELIVERY", ownerId: orderId, purpose: "POD_EVIDENCE", status: { in: ["READY", "RETAINED"] }, detectedMimeType: { in: ["image/jpeg", "image/png", "image/webp"] } }, select: { id: true } });
  if (!proof || !media || proof.driverProfileId !== proof.assignment.driverProfileId) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Order-owned private delivery evidence is required.");
  return proof;
}

/** A report records an operational allegation. It never records cash, proof of
 * collection, delivery completion, financial settlement, or driver liability. */
export async function reportCodPhysicalDeliveryException(actor: AuthenticatedUser, orderId: string, input: { operationId: string; reason: string; evidenceReference?: string }) {
  await authorize(actor, true); validate(input);
  if (!input.evidenceReference) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Order-owned private delivery evidence is required.");
  const requestHash = digest({ orderId, reason: input.reason.trim(), evidenceReference: input.evidenceReference, actorId: actor.id });
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CodPhysicalDeliveryExceptionError("NOT_COD_ORDER", "This order has no cash obligation.");
    const cod = await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: rows[0].id }, include: { order: { select: { status: true, currentDriverProfileId: true } } } });
    const operationId = `physical-report:${input.operationId}`;
    const prior = await tx.cashOnDeliveryEvent.findUnique({ where: { operationId } });
    if (prior) {
      if (prior.cashOnDeliveryId !== cod.id || prior.actorUserId !== actor.id || prior.requestHash !== requestHash || prior.eventType !== "PHYSICAL_DELIVERY_REPORTED") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The operation reference was already used.");
      const saved = prior.safeEvidence && typeof prior.safeEvidence === "object" && !Array.isArray(prior.safeEvidence) ? prior.safeEvidence as Record<string, unknown> : {};
      if (typeof saved.cashOutstanding !== "string") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The stored report receipt is incomplete.");
      return { status: "REVIEW_PENDING", cashOutstanding: saved.cashOutstanding };
    }
    if (!["PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(cod.order.status) || cod.status !== "READY_FOR_COLLECTION" || !cod.order.currentDriverProfileId || !cod.digitalPaid.equals(cod.digitalRequired) || cod.cashCollected.greaterThanOrEqualTo(cod.cashObligation) || cod.reconciliationStatus !== "PENDING") throw new CodPhysicalDeliveryExceptionError("NOT_ELIGIBLE", "An active assigned COD delivery with outstanding cash is required.");
    const proof = await assertOrderEvidence(tx, orderId, input.evidenceReference);
    if (proof.driverProfileId !== cod.order.currentDriverProfileId) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Evidence must belong to the current assigned driver.");
    await tx.cashOnDelivery.update({ where: { id: cod.id }, data: { reconciliationStatus: PENDING, version: { increment: 1 }, events: { create: { operationId, requestHash, eventType: "PHYSICAL_DELIVERY_REPORTED", actorUserId: actor.id, safeReasonCode: "PHYSICAL_DELIVERY_CASH_OUTSTANDING", safeEvidence: { evidenceReference: input.evidenceReference, driverId: cod.order.currentDriverProfileId, cashOutstanding: cod.cashObligation.sub(cod.cashCollected).toFixed(2) } } } } });
    await tx.adminActivityLog.create({ data: { actorUserId: actor.id, action: "CREATE", entityType: "CashOnDelivery", entityId: cod.id, message: "Reported physical delivery with cash outstanding for independent review.", metadata: sanitizeLogContext({ reason: input.reason.trim() }) as Prisma.InputJsonValue } });
    await recordAdminAlertIntentInTx(tx, { eventType: "COD_RECONCILIATION_DISCREPANCY", aggregateReference: operationId, title: "Reported delivery with cash outstanding", summary: "Independent cash review is required; no collection has been recorded by this report.", adminPath: `/admin/orders/${orderId}`, relatedOrderId: orderId, metadata: { codReference: cod.publicReference } });
    return response("REVIEW_PENDING", cod);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Independent review records the reported physical event only. Outstanding
 * cash remains an obligation and cannot fund settlement or earnings. */
export async function reviewCodPhysicalDeliveryException(actor: AuthenticatedUser, orderId: string, input: { operationId: string; decision: "VERIFY" | "REJECT"; reason: string }) {
  await authorize(actor, false); validate(input);
  if (!["VERIFY", "REJECT"].includes(input.decision)) throw new CodPhysicalDeliveryExceptionError("INVALID_INPUT", "A valid review decision is required.");
  const requestHash = digest({ orderId, reason: input.reason.trim(), decision: input.decision, actorId: actor.id });
  return withLedgerRetry(() => prisma.$transaction(async tx => {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${orderId} FOR UPDATE`);
    if (rows.length !== 1) throw new CodPhysicalDeliveryExceptionError("NOT_COD_ORDER", "This order has no cash obligation.");
    const cod = await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: rows[0].id }, include: { order: { select: { currentDriverProfileId: true } } } });
    const operationId = `physical-review:${input.operationId}`;
    const prior = await tx.cashOnDeliveryEvent.findUnique({ where: { operationId } });
    if (prior) {
      if (prior.cashOnDeliveryId !== cod.id || prior.actorUserId !== actor.id || prior.requestHash !== requestHash || prior.eventType !== "PHYSICAL_DELIVERY_REVIEWED") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The operation reference was already used.");
      const saved = prior.safeEvidence && typeof prior.safeEvidence === "object" && !Array.isArray(prior.safeEvidence) ? prior.safeEvidence as Record<string, unknown> : {};
      if (typeof saved.resultStatus !== "string" || typeof saved.cashOutstanding !== "string") throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The stored review receipt is incomplete.");
      return {
        status: saved.resultStatus,
        cashOutstanding: saved.cashOutstanding,
        ...(typeof saved.shortageJournalReference === "string"
          ? { shortageJournalReference: saved.shortageJournalReference }
          : {}),
      };
    }
    if (cod.reconciliationStatus !== PENDING) throw new CodPhysicalDeliveryExceptionError("NOT_PENDING", "There is no pending physical-delivery report to review.");
    const report = await tx.cashOnDeliveryEvent.findFirst({ where: { cashOnDeliveryId: cod.id, eventType: "PHYSICAL_DELIVERY_REPORTED" }, orderBy: { createdAt: "desc" } });
    if (!report || !report.actorUserId || report.actorUserId === actor.id) throw new CodPhysicalDeliveryExceptionError("INDEPENDENT_REVIEW_REQUIRED", "A different authorized finance reviewer must review the report.");
    const evidence = report.safeEvidence && typeof report.safeEvidence === "object" && !Array.isArray(report.safeEvidence) ? report.safeEvidence as Record<string, unknown> : {};
    if (input.decision === "VERIFY") {
      const proof = await assertOrderEvidence(tx, orderId, typeof evidence.evidenceReference === "string" ? evidence.evidenceReference : undefined);
      if (proof.driverProfileId !== cod.order.currentDriverProfileId) throw new CodPhysicalDeliveryExceptionError("EVIDENCE_REQUIRED", "Evidence must belong to the current assigned driver.");
    }
    if (!["READY_FOR_COLLECTION", "COLLECTED"].includes(cod.status)) throw new CodPhysicalDeliveryExceptionError("CASH_STATE_CHANGED", "Cash state changed; review the current collection evidence.");
    const cashOutstandingDecimal = Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), 0);
    const cashOutstanding = cashOutstandingDecimal.toFixed(2);
    const resultStatus =
      input.decision === "REJECT"
        ? "REJECTED"
        : cod.cashCollected.greaterThanOrEqualTo(cod.cashObligation)
          ? "VERIFIED_CASH_COLLECTED"
          : "VERIFIED_CASH_OUTSTANDING";

    let shortageJournalId: string | null = cod.suspenseJournalId ?? null;
    let shortageJournalReference: string | null = null;

    if (input.decision === "VERIFY" && resultStatus === "VERIFIED_CASH_OUTSTANDING" && cashOutstandingDecimal.greaterThan(0)) {
      const { receivableAccount, suspenseAccount } = await ensureShortageReceivableAccounts(tx);
      const journal = await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: `cod-physical-shortage:${cod.id}`,
        type: "GENERAL",
        currency: "ZAR",
        sourceReference: `cod:${cod.publicReference}:uncollected-shortage`,
        correlationId: cod.publicReference,
        memo: `Verified physical delivery with uncollected COD cash shortage (${cod.publicReference})`,
        actor: { kind: "USER", userId: actor.id },
        metadata: {
          codReference: cod.publicReference,
          orderId,
          driverId: cod.order.currentDriverProfileId,
          reportEventId: report.id,
          cashOutstanding,
          accountingTreatment: "UNCOLLECTED_COD_RECEIVABLE_AND_SUSPENSE",
        },
        entries: [
          {
            accountId: receivableAccount.id,
            direction: "DEBIT",
            amount: cashOutstanding,
            lineCode: "COD_UNCOLLECTED_SHORTAGE_RECEIVABLE",
          },
          {
            accountId: suspenseAccount.id,
            direction: "CREDIT",
            amount: cashOutstanding,
            lineCode: "COD_UNCOLLECTED_SHORTAGE_SUSPENSE",
          },
        ],
      });
      shortageJournalId = journal.id;
      shortageJournalReference = journal.reference;
    }

    await tx.cashOnDelivery.update({
      where: { id: cod.id },
      data: {
        reconciliationStatus: input.decision === "VERIFY" ? VERIFIED : "PENDING",
        ...(shortageJournalId && !cod.suspenseJournalId
          ? {
              suspenseJournalId: shortageJournalId,
              remittanceDiscrepancy: cashOutstandingDecimal,
            }
          : {}),
        version: { increment: 1 },
        events: {
          create: {
            operationId,
            requestHash,
            eventType: "PHYSICAL_DELIVERY_REVIEWED",
            actorUserId: actor.id,
            safeReasonCode: input.decision,
            safeEvidence: {
              reportEventId: report.id,
              resultStatus,
              cashOutstanding,
              ...(shortageJournalReference ? { shortageJournalReference } : {}),
            },
          },
        },
      },
    });
    await tx.adminActivityLog.create({ data: { actorUserId: actor.id, action: "STATUS_CHANGE", entityType: "CashOnDelivery", entityId: cod.id, message: "Independently reviewed the physical-delivery report.", metadata: sanitizeLogContext({ decision: input.decision, reason: input.reason.trim(), resultStatus, cashOutstanding, ...(shortageJournalReference ? { shortageJournalReference } : {}) }) as Prisma.InputJsonValue } });
    return {
      ...response(resultStatus, cod),
      ...(shortageJournalReference ? { shortageJournalReference } : {}),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function resolveCodPhysicalDeliveryShortage(
  actor: AuthenticatedUser,
  orderId: string,
  input: {
    operationId: string;
    resolution: "DISPUTED" | "RECOVERED" | "WRITTEN_OFF";
    debtorParty?: "RECIPIENT" | "DRIVER" | "PLATFORM_WRITE_OFF";
    reason: string;
    evidenceReference?: string;
  },
) {
  await authorize(actor, false);
  validate(input);
  if (!["DISPUTED", "RECOVERED", "WRITTEN_OFF"].includes(input.resolution)) {
    throw new CodPhysicalDeliveryExceptionError("INVALID_INPUT", "A valid shortage resolution is required.");
  }
  const requestHash = digest({
    orderId,
    resolution: input.resolution,
    debtorParty: input.debtorParty ?? null,
    reason: input.reason.trim(),
    evidenceReference: input.evidenceReference ?? null,
    actorId: actor.id,
  });

  return withLedgerRetry(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`);
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "CashOnDelivery" WHERE "orderId" = ${orderId} FOR UPDATE`,
        );
        if (rows.length !== 1) {
          throw new CodPhysicalDeliveryExceptionError("NOT_COD_ORDER", "This order has no cash obligation.");
        }
        const cod = await tx.cashOnDelivery.findUniqueOrThrow({ where: { id: rows[0].id } });
        const operationId = `physical-resolve:${input.operationId}`;
        const prior = await tx.cashOnDeliveryEvent.findUnique({ where: { operationId } });
        if (prior) {
          if (
            prior.cashOnDeliveryId !== cod.id ||
            prior.actorUserId !== actor.id ||
            prior.requestHash !== requestHash ||
            prior.eventType !== "PHYSICAL_DELIVERY_SHORTAGE_RESOLVED"
          ) {
            throw new CodPhysicalDeliveryExceptionError("CONFLICT", "The operation reference was already used.");
          }
          const saved =
            prior.safeEvidence && typeof prior.safeEvidence === "object" && !Array.isArray(prior.safeEvidence)
              ? (prior.safeEvidence as Record<string, unknown>)
              : {};
          return {
            status: String(saved.resultStatus ?? input.resolution),
            cashOutstanding: String(saved.cashOutstanding ?? "0.00"),
            ...(typeof saved.clearingJournalReference === "string"
              ? { clearingJournalReference: saved.clearingJournalReference }
              : {}),
          };
        }

        if (!cod.suspenseJournalId || !["PHYSICAL_DELIVERY_VERIFIED", "PHYSICAL_DELIVERY_SHORTAGE_DISPUTED"].includes(cod.reconciliationStatus)) {
          throw new CodPhysicalDeliveryExceptionError(
            "NOT_ELIGIBLE",
            "An independently verified physical-delivery cash shortage is required before resolution.",
          );
        }
        if (cod.adjustmentJournalId) {
          throw new CodPhysicalDeliveryExceptionError(
            "ALREADY_RESOLVED",
            "This physical-delivery cash shortage has already been cleared.",
          );
        }

        const reviewEvent = await tx.cashOnDeliveryEvent.findFirst({
          where: { cashOnDeliveryId: cod.id, eventType: "PHYSICAL_DELIVERY_REVIEWED" },
          orderBy: { createdAt: "desc" },
        });
        if (!reviewEvent || reviewEvent.actorUserId === actor.id) {
          throw new CodPhysicalDeliveryExceptionError(
            "INDEPENDENT_REVIEW_REQUIRED",
            "A separate authorized finance actor must resolve or clear the verified shortage.",
          );
        }

        const shortageAmount = cod.remittanceDiscrepancy.greaterThan(0)
          ? cod.remittanceDiscrepancy
          : Prisma.Decimal.max(cod.cashObligation.sub(cod.cashCollected), 0);
        if (shortageAmount.lessThanOrEqualTo(0)) {
          throw new CodPhysicalDeliveryExceptionError("NOT_ELIGIBLE", "No positive uncollected cash shortage remains.");
        }

        if (input.resolution === "DISPUTED") {
          const nextStatus = "PHYSICAL_DELIVERY_SHORTAGE_DISPUTED";
          await tx.cashOnDelivery.update({
            where: { id: cod.id },
            data: {
              reconciliationStatus: nextStatus,
              adminAdjustmentReason: input.reason.trim(),
              version: { increment: 1 },
              events: {
                create: {
                  operationId,
                  requestHash,
                  eventType: "PHYSICAL_DELIVERY_SHORTAGE_RESOLVED",
                  actorUserId: actor.id,
                  safeReasonCode: "DISPUTED",
                  safeEvidence: {
                    resultStatus: nextStatus,
                    debtorParty: input.debtorParty ?? "UNDETERMINED",
                    cashOutstanding: shortageAmount.toFixed(2),
                  },
                },
              },
            },
          });
          return { status: nextStatus, cashOutstanding: shortageAmount.toFixed(2) };
        }

        if (input.resolution === "RECOVERED" && !input.evidenceReference?.trim()) {
          throw new CodPhysicalDeliveryExceptionError(
            "EVIDENCE_REQUIRED",
            "An external recovery receipt reference is required to clear a shortage as recovered.",
          );
        }

        const { receivableAccount, suspenseAccount } = await ensureShortageReceivableAccounts(tx);
        const clearJournal = await postLedgerJournalWithinTransaction(tx, {
          idempotencyKey: `cod-physical-shortage-clear:${cod.id}`,
          type: "GENERAL",
          currency: "ZAR",
          sourceReference: `cod:${cod.publicReference}:uncollected-shortage-clear`,
          correlationId: cod.publicReference,
          memo: `Cleared uncollected COD shortage (${input.resolution}): ${input.reason.trim()}`,
          actor: { kind: "USER", userId: actor.id },
          metadata: {
            codReference: cod.publicReference,
            orderId,
            resolution: input.resolution,
            debtorParty: input.debtorParty ?? (input.resolution === "WRITTEN_OFF" ? "PLATFORM_WRITE_OFF" : "RECIPIENT"),
            evidenceReference: input.evidenceReference ?? null,
          },
          entries: [
            {
              accountId: suspenseAccount.id,
              direction: "DEBIT",
              amount: shortageAmount.toFixed(2),
              lineCode: "COD_UNCOLLECTED_SHORTAGE_SUSPENSE_CLEARED",
            },
            {
              accountId: receivableAccount.id,
              direction: "CREDIT",
              amount: shortageAmount.toFixed(2),
              lineCode:
                input.resolution === "RECOVERED"
                  ? "COD_UNCOLLECTED_SHORTAGE_RECEIVABLE_RECOVERED"
                  : "COD_UNCOLLECTED_SHORTAGE_RECEIVABLE_WRITTEN_OFF",
            },
          ],
        });

        const nextStatus =
          input.resolution === "RECOVERED"
            ? "PHYSICAL_DELIVERY_SHORTAGE_RECOVERED"
            : "PHYSICAL_DELIVERY_SHORTAGE_WRITTEN_OFF";

        await tx.cashOnDelivery.update({
          where: { id: cod.id },
          data: {
            reconciliationStatus: nextStatus,
            adjustmentJournalId: clearJournal.id,
            remittanceDiscrepancy: new Prisma.Decimal(0),
            adminAdjustmentReason: input.reason.trim(),
            adminAdjustedByUserId: actor.id,
            adminAdjustedAt: new Date(),
            version: { increment: 1 },
            events: {
              create: {
                operationId,
                requestHash,
                eventType: "PHYSICAL_DELIVERY_SHORTAGE_RESOLVED",
                actorUserId: actor.id,
                safeReasonCode: input.resolution,
                safeEvidence: {
                  resultStatus: nextStatus,
                  cashOutstanding: "0.00",
                  clearedAmount: shortageAmount.toFixed(2),
                  clearingJournalReference: clearJournal.reference,
                  debtorParty: input.debtorParty ?? (input.resolution === "WRITTEN_OFF" ? "PLATFORM_WRITE_OFF" : "RECIPIENT"),
                  evidenceReference: input.evidenceReference ?? null,
                },
              },
            },
          },
        });

        await tx.adminActivityLog.create({
          data: {
            actorUserId: actor.id,
            action: "STATUS_CHANGE",
            entityType: "CashOnDelivery",
            entityId: cod.id,
            message: `Resolved physical-delivery COD shortage (${input.resolution}).`,
            metadata: sanitizeLogContext({
              resolution: input.resolution,
              clearedAmount: shortageAmount.toFixed(2),
              clearingJournalReference: clearJournal.reference,
            }) as Prisma.InputJsonValue,
          },
        });

        return {
          status: nextStatus,
          cashOutstanding: "0.00",
          clearingJournalReference: clearJournal.reference,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
