import { Prisma } from "@prisma/client";
import type { ParsedPayfastItn } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import { parsePayfastItnForm } from "@/lib/payments/providers/payfast/payfast-itn-parser";
import type { ResolvedPayfastItnAttempt } from "@/lib/services/payfast-itn-resolution.service";
import { sandboxConfig } from "./payfast-test-fixtures";

export const fixedItnSignature = "3af95032720fc38f5d83197919f2329f";
export const fixedItnBody = `m_payment_id=kt%3Apayment%3Apay_abcdefghijklmnop%3Aattempt%3A1&pf_payment_id=123456&payment_status=COMPLETE&amount_gross=123.45&merchant_id=10000100&custom_str1=hello+world&signature=${fixedItnSignature}`;
export const fixedParsedItn: ParsedPayfastItn = parsePayfastItnForm(fixedItnBody);
export const fixedItnConfig = Object.freeze({ ...sandboxConfig, merchantId: "10000100", passphrase: "top secret" });
export const fixedAttempt: ResolvedPayfastItnAttempt = Object.freeze({
  id: "attempt-id", publicReference: "pat_abcdefghijklmnopqrstuvwx", paymentId: "payment-id", attemptNumber: 1,
  merchantReference: "kt:payment:pay_abcdefghijklmnop:attempt:1", providerReference: null, status: "REQUIRES_ACTION",
  amount: new Prisma.Decimal("123.45"), currency: "ZAR", providerEnvironment: "SANDBOX", providerCredentialVersion: "sandbox-v1", version: 1,
  payment: Object.freeze({ id: "payment-id", publicReference: "pay_abcdefghijklmnop", status: "REQUIRES_ACTION", amount: new Prisma.Decimal("123.45"), currency: "ZAR", version: 1, successWebhookEventId: null, successLedgerJournalId: null, successfulAttemptId: null }),
});
