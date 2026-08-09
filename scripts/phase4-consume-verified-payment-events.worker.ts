import { consumeVerifiedPaymentEvents } from "@/lib/payments/verified-payment-event-processor.service";

const index = process.argv.indexOf("--limit");
const limit = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error("A bounded --limit between 1 and 500 is required.");

const outcomes = await consumeVerifiedPaymentEvents({ limit });
console.log(JSON.stringify({ processor: "PAYMENT_SUCCEEDED_VERIFIED", outcomes }));
