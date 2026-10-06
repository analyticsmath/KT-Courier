import { evaluateProductionConfiguration } from '../lib/config/production-validation';
import { getIntegrationRegistry } from '../lib/security/integration-registry';
import { resolvePaystackConfiguration } from '../lib/payments/providers/paystack/paystack-config';
import { evaluateMarketplaceCheckoutPublicGate } from '../lib/marketplace-checkout/production-lock';

const paystack = resolvePaystackConfiguration();
console.log(JSON.stringify({ event: 'kt_go_live_environment_assessment',
  configuration: evaluateProductionConfiguration(),
  integrations: getIntegrationRegistry(),
  checkout: evaluateMarketplaceCheckoutPublicGate(),
  paystack: paystack.state,
  safeFlags: Object.fromEntries(['NODE_ENV','KT_DATABASE_CLASSIFICATION','CHECKOUT_PUBLIC_ENABLED','PAYSTACK_MODE','EMAIL_PROVIDER','CATALOG_MEDIA_DELIVERY','NOTIFICATION_PRODUCTION_VALIDATION_APPROVED','WITHDRAWAL_PAYOUT_ENABLED','NEXT_PUBLIC_APP_URL','PAYMENT_APP_ORIGIN'].map(k=>[k,process.env[k]??null])),
  keyClassification: { paystack: process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_')?'live':process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_')?'test':process.env.PAYSTACK_SECRET_KEY?'unrecognized':'missing', resend: Boolean(process.env.RESEND_API_KEY?.trim()), emailSender: Boolean(process.env.EMAIL_FROM?.trim()), notificationVault: Boolean(process.env.NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY?.trim()), otpHmac: Boolean(process.env.AUTH_OTP_HMAC_KEY?.trim()) },
}));
