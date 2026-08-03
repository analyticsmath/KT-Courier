import { prisma } from "@/lib/db/prisma";
import { PaymentError } from "@/lib/payments/errors";
import type { PaymentProviderEnvironment } from "@/lib/payments/types";
import type { PayfastRuntimeConfiguration } from "@/lib/payments/providers/payfast/payfast-config";

export type ResolvedPayfastItnAttempt = Readonly<{
  id: string;
  publicReference: string;
  paymentId: string;
  attemptNumber: number;
  merchantReference: string;
  providerReference: string | null;
  status: string;
  amount: import("@prisma/client").Prisma.Decimal;
  currency: string;
  providerEnvironment: PaymentProviderEnvironment;
  providerCredentialVersion: string;
  version: number;
  payment: Readonly<{
    id: string;
    publicReference: string;
    status: string;
    amount: import("@prisma/client").Prisma.Decimal;
    currency: string;
    version: number;
    successWebhookEventId: string | null;
    successLedgerJournalId: string | null;
    successfulAttemptId: string | null;
  }>;
}>;

export async function resolvePayfastItnAttempt(merchantReference: string): Promise<ResolvedPayfastItnAttempt> {
  const found = await prisma.paymentAttempt.findUnique({
    where: { merchantReference },
    include: { payment: true },
  });
  const attempt = found as unknown as ResolvedPayfastItnAttempt | null;
  if (
    !attempt
    || (attempt as unknown as { provider: string }).provider !== "PAYFAST"
    || !attempt.payment
    || !attempt.publicReference
    || !attempt.providerEnvironment
    || !attempt.providerCredentialVersion
    || attempt.currency !== "ZAR"
    || attempt.payment.currency !== "ZAR"
  ) {
    throw new PaymentError("PAYMENT_ATTEMPT_NOT_FOUND", "Payfast payment attempt was not found.");
  }
  return Object.freeze(attempt);
}

export function assertPayfastItnAttemptConfiguration(
  attempt: ResolvedPayfastItnAttempt,
  runtime: PayfastRuntimeConfiguration,
): void {
  const environment = runtime.environment === "sandbox" ? "SANDBOX" : "PRODUCTION";
  if (attempt.providerEnvironment !== environment) {
    throw new PaymentError("PAYFAST_CONFIGURATION_INVALID", "Payfast attempt environment does not match active configuration.");
  }
  if (attempt.providerCredentialVersion !== runtime.credentialVersion) {
    throw new PaymentError("PAYFAST_CREDENTIAL_VERSION_MISMATCH", "Payfast credential version does not match the attempt.");
  }
}
