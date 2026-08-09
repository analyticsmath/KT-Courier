import { consumeVerifiedPaymentEvents } from "@/lib/payments/verified-payment-event-processor.service";

const limit = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 100);
const outcomes = await consumeVerifiedPaymentEvents({ limit, subjectTypes: ["MARKETPLACE_CHECKOUT"] });
console.log(JSON.stringify({ processor: "PAYMENT_SUCCEEDED_VERIFIED", outcomes }));
