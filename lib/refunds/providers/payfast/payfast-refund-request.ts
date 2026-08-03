import { RefundError } from "../../errors";
import type { ProviderRefundInput } from "../refund-provider-adapter";
import type { PayfastRefundRuntimeConfiguration } from "./payfast-refund-config";
import { buildPayfastApiHeaders } from "./payfast-api-signature";
import { serializePayfastRefundAmount, validateRefundAmountForProtocol, type PayfastRefundAmountSerializer } from "./payfast-refund-amount";

const SAFE_PROVIDER_ID = /^[A-Za-z0-9_.:-]{1,160}$/;

export type PayfastRefundApiRequest = Readonly<{
  url: string;
  method: "POST";
  headers: Readonly<Record<string, string>>;
  body: string;
  safeRequestSnapshot: Readonly<Record<string, string | boolean>>;
}>;

function providerReason(reasonCode: string): string {
  return `KT_COURIERS_${reasonCode}`.slice(0, 120);
}

export function buildPayfastRefundRequest(
  input: ProviderRefundInput,
  configuration: PayfastRefundRuntimeConfiguration,
  options: Readonly<{ timestamp: string; amountSerializer?: PayfastRefundAmountSerializer }>,
): PayfastRefundApiRequest {
  if (!SAFE_PROVIDER_ID.test(input.providerPaymentId) || input.currency !== "ZAR") {
    throw new RefundError("REFUND_PROVIDER_RESPONSE_INVALID", "Payfast refund request identity is invalid.");
  }
  const amountDecimal = validateRefundAmountForProtocol(input.amount);
  const amount = options.amountSerializer
    ? options.amountSerializer(amountDecimal)
    : serializePayfastRefundAmount(input.amount);
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(amount)) throw new RefundError("REFUND_PROVIDER_NOT_READY", "Payfast protocol amount serializer returned an invalid value.");
  const bodyFields = Object.freeze({ amount, reason: providerReason(input.reasonCode), notify_buyer: "0" });
  const headers = buildPayfastApiHeaders({ merchantId: configuration.merchantId, passphrase: configuration.passphrase, timestamp: options.timestamp, body: bodyFields });
  return Object.freeze({
    url: `${configuration.apiOrigin}/refunds/${encodeURIComponent(input.providerPaymentId)}`,
    method: "POST",
    headers: Object.freeze({ ...headers, "content-type": "application/json", accept: "application/json" }),
    body: JSON.stringify(bodyFields),
    safeRequestSnapshot: Object.freeze({ amount, reasonCode: input.reasonCode, notifyBuyer: false, protocolVersion: configuration.apiVersion }),
  });
}

