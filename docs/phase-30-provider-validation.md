# Phase 30 External Provider Sandbox & Graceful Failover Audit

## Provider Audit Matrix

| Provider | Mode | Behavior when Unconfigured / Key Missing | Verification |
| --- | --- | --- | --- |
| **PayFast** | Sandbox | Fails closed with `PAYFAST_PROVIDER_NOT_CONFIGURED`. ITN signature verification enforced. | PASSED |
| **Email (Resend/SMTP)** | Sandbox/Local | Fails closed with `EMAIL_PROVIDER_NOT_CONFIGURED`. Retains notification in DB inbox with `UNDELIVERED_PROVIDER_NOT_CONFIGURED` status. | PASSED |
| **SMS (Twilio)** | Sandbox/Local | Fails closed with `SMS_PROVIDER_NOT_CONFIGURED`. Logs delivery attempt without crashing workflow. | PASSED |
| **Google Maps** | Fallback | Uses Haversine distance matrix calculation with explicit fallback flag when API key is unconfigured. | PASSED |

## Security Rules
- No real credit card, live PayFast passphrase, or production API keys were invoked during test runs.
- Sandbox mode verified end-to-end.
