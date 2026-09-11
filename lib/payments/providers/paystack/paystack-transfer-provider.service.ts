import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import {
  PaystackClient,
  type PaystackValidateAccountInput,
} from "@/lib/payments/providers/paystack/paystack-client";
import { resolvePaystackConfiguration } from "@/lib/payments/providers/paystack/paystack-config";
import type { WalletOwnerType, PayoutDestination } from "@prisma/client";

export type SetupTransferRecipientInput = Readonly<{
  walletId: string;
  ownerType: WalletOwnerType;
  ownerId: string;
  accountName: string;
  accountNumber: string;
  bankCode: string;
  institutionName?: string;
  accountType?: "personal" | "business";
  documentType?: "identityNumber" | "passportNumber" | "businessRegistrationNumber";
  documentNumber?: string;
  actorUserId?: string;
  clientOverride?: PaystackClient;
}>;

export type SetupTransferRecipientResult = Readonly<{
  payoutDestinationId: string;
  publicReference: string;
  recipientCode: string;
  maskedLabel: string;
  status: "ACTIVE" | "PENDING_REVIEW";
  validationStatus: "VALIDATED" | "PENDING_MANUAL_REVIEW" | "FAILED";
  payoutDestination?: PayoutDestination;
}>;

export function hashAccountNumber(accountNumber: string): string {
  return crypto.createHash("sha256").update(`za-bank:${accountNumber.trim()}`).digest("hex");
}

export function maskAccountNumber(accountNumber: string): { maskedLabel: string; accountLast4: string } {
  const cleaned = accountNumber.trim().replace(/\s+/g, "");
  const last4 = cleaned.slice(-4);
  return {
    maskedLabel: `•••• ${last4}`,
    accountLast4: last4,
  };
}

export async function setupPaystackTransferRecipient(
  input: SetupTransferRecipientInput,
): Promise<SetupTransferRecipientResult> {
  const accountName = input.accountName.trim();
  const accountNumber = input.accountNumber.trim().replace(/\s+/g, "");
  const bankCode = input.bankCode.trim();

  if (!accountName || !accountNumber || !bankCode) {
    throw new PaymentError("PAYMENT_PROVIDER_REQUEST_INVALID", "Account name, account number, and bank code are required.");
  }
  if (!/^\d{6,16}$/.test(accountNumber)) {
    throw new PaymentError("PAYMENT_PROVIDER_REQUEST_INVALID", "Invalid South African bank account number format.");
  }

  const accountFingerprint = hashAccountNumber(accountNumber);
  const { maskedLabel, accountLast4 } = maskAccountNumber(accountNumber);

  const secretKey = resolvePaystackConfiguration().runtime?.secretKey ?? process.env.PAYSTACK_SECRET_KEY?.trim();
  const client = input.clientOverride ?? (secretKey ? new PaystackClient({ secretKey }) : null);

  // Check if wallet already has an active destination
  const existingActive = await prisma.payoutDestination.findFirst({
    where: {
      walletId: input.walletId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });

  // If active destination exists with the same account fingerprint and bank code, reuse it
  if (
    existingActive &&
    existingActive.accountFingerprint === accountFingerprint &&
    existingActive.providerCode === bankCode &&
    existingActive.method === "PAYSTACK_TRANSFER"
  ) {
    return Object.freeze({
      payoutDestinationId: existingActive.id,
      publicReference: existingActive.publicReference,
      recipientCode: existingActive.externalReference,
      maskedLabel: existingActive.maskedLabel,
      status: "ACTIVE" as const,
      validationStatus: (existingActive.payoutValidationStatus as "VALIDATED" | "PENDING_MANUAL_REVIEW") ?? "VALIDATED",
      payoutDestination: existingActive,
    });
  }

  // Attempt Paystack account validation if supported and KYC available
  let validationStatus: "VALIDATED" | "PENDING_MANUAL_REVIEW" | "FAILED" = "PENDING_MANUAL_REVIEW";
  let validationEvidence: Record<string, unknown> | null = null;

  if (client && input.accountType && input.documentType && input.documentNumber) {
    try {
      const validatePayload: PaystackValidateAccountInput = {
        account_name: accountName,
        account_number: accountNumber,
        account_type: input.accountType,
        bank_code: bankCode,
        country_code: "ZA",
        document_type: input.documentType,
        document_number: input.documentNumber,
      };
      const validationResp = await client.validateAccount(validatePayload);
      if (validationResp.verified) {
        validationStatus = "VALIDATED";
        validationEvidence = {
          verificationStatus: validationResp.verification_status,
          verifiedAt: new Date().toISOString(),
        };
      } else {
        validationStatus = "PENDING_MANUAL_REVIEW";
        validationEvidence = {
          verificationStatus: validationResp.verification_status,
          note: "Paystack did not affirmatively verify bank account; routed to manual review",
        };
      }
    } catch {
      // Fail closed: bank account validation not supported or failed -> manual review required
      validationStatus = "PENDING_MANUAL_REVIEW";
      validationEvidence = {
        note: "Provider automated verification unavailable; requires manual finance review",
      };
    }
  }

  // Create transfer recipient on Paystack
  let recipientCode = `RCP_MOCK_${crypto.randomUUID().slice(0, 12)}`;
  if (client) {
    try {
      const recipientData = await client.createTransferRecipient({
        type: "basa",
        name: accountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "ZAR",
        description: `Marketplace payout for ${input.ownerType}:${input.ownerId}`,
      });
      recipientCode = recipientData.recipient_code;
    } catch (error) {
      throw new PaymentError(
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Failed to register bank recipient with Paystack.",
        true,
        { cause: error },
      );
    }
  }

  const now = new Date();
  const initialStatus = validationStatus === "VALIDATED" ? "ACTIVE" : "PENDING_REVIEW";

  // Atomically: if previous destination existed and details changed, suspend/revoke previous destination
  return prisma.$transaction(async (tx) => {
    if (existingActive) {
      await tx.payoutDestination.update({
        where: { id: existingActive.id },
        data: {
          status: "REVOKED",
          disabledAt: now,
          disabledByUserId: input.actorUserId ?? null,
          version: { increment: 1 },
        },
      });
    }

    const publicReference = `DST-${crypto.randomUUID().replaceAll("-", "").toUpperCase().slice(0, 16)}`;

    const destination = await tx.payoutDestination.create({
      data: {
        publicReference,
        walletId: input.walletId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        method: "PAYSTACK_TRANSFER",
        providerCode: bankCode,
        externalReference: recipientCode,
        maskedLabel,
        institutionName: input.institutionName ?? "South African Bank",
        accountLast4,
        accountFingerprint,
        payoutValidationStatus: validationStatus,
        payoutValidationEvidence: validationEvidence ? (validationEvidence as unknown as import("@prisma/client").Prisma.InputJsonValue) : undefined,
        currency: "ZAR",
        countryCode: "ZA",
        status: initialStatus,
        verifiedAt: initialStatus === "ACTIVE" ? now : null,
        verifiedByUserId: initialStatus === "ACTIVE" ? (input.actorUserId ?? null) : null,
      },
    });

    return Object.freeze({
      payoutDestinationId: destination.id,
      publicReference: destination.publicReference,
      recipientCode,
      maskedLabel,
      status: destination.status as "ACTIVE" | "PENDING_REVIEW",
      validationStatus,
      payoutDestination: destination,
    });
  });
}
