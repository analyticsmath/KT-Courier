import { PayfastAdapter } from "@/lib/payments/providers/payfast/payfast-adapter";
import { buildPayfastCallbackUrls } from "@/lib/payments/providers/payfast/payfast-callback-urls";
import type { PayfastRuntimeConfiguration } from "@/lib/payments/providers/payfast/payfast-config";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";

export const payfastIntegrationConfiguration: PayfastRuntimeConfiguration = Object.freeze({
  mode: "sandbox", environment: "sandbox", merchantId: "integration-merchant-id", merchantKey: "integration-merchant-key", passphrase: "integration-private-passphrase", credentialVersion: "integration-sandbox-v1",
  appOrigin: "https://payfast-integration.example.test", processingEndpoint: "https://sandbox.payfast.co.za/eng/process", signatureVersion: "payfast-md5-v1", requestFieldVersion: "payfast-custom-checkout-v1", configurationFingerprint: "payfast-v1:sandbox",
});
export const payfastIntegrationRegistry = () => new PaymentProviderRegistry({ adapters: [new PayfastAdapter(payfastIntegrationConfiguration)] });
export const payfastIntegrationCallbacks = (publicReference: string) => buildPayfastCallbackUrls(payfastIntegrationConfiguration.appOrigin, publicReference);
