/**
 * Backwards-compatible reward-domain alias. Both parcel loyalty and
 * marketplace settlement share one exact external-funding predicate.
 */
export { isCanonicalExternalPaymentReceipt as isCanonicalCustomerPaymentReceipt } from "@/lib/payments/canonical-external-receipt";
