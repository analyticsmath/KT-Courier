# KT Couriers — Integration Readiness Registry

| Integration ID | Name | Category | Configured Mode | Enabled | Readiness | Production Eligible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `payfast` | PayFast Custom Checkout | PAYMENT_GATEWAY | `disabled` | False | `DISABLED` | False |
| `google-maps-browser` | Google Maps Browser | GEOLOCATION | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `google-maps-server` | Google Maps Server | ROUTING | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `google-identity` | Google OAuth | AUTHENTICATION | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `resend-email` | Resend Transactional Email | COMMUNICATION | `mock` | True | `MOCK_READY` | False |
| `sms-notifications` | SMS Messaging | COMMUNICATION | `disabled` | False | `CREDENTIAL_PENDING` | False (Launch Scope Registered) |
| `whatsapp-notifications` | WhatsApp Business | COMMUNICATION | `disabled` | False | `CREDENTIAL_PENDING` | False (Launch Scope Registered) |
| `push-notifications` | Firebase Cloud Messaging | COMMUNICATION | `disabled` | False | `CREDENTIAL_PENDING` | False (Launch Scope Registered) |
| `object-storage` | S3 / R2 Storage | STORAGE | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `payout-provider` | Bank Payout Gateway | PAYOUTS | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `error-monitoring` | Sentry | OBSERVABILITY | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `analytics` | Product Analytics | OBSERVABILITY | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `captcha-anti-abuse` | Cloudflare Turnstile | SECURITY | `disabled` | False | `CREDENTIAL_PENDING` | False |
| `developer-api-auth` | Developer API Auth | DEVELOPER_PLATFORM | `sandbox` | True | `SANDBOX_READY` | False |
| `developer-webhooks` | Outbound Webhooks | DEVELOPER_PLATFORM | `sandbox` | True | `SANDBOX_READY` | False |

*Note: Incomplete integrations (SMS, WhatsApp, Push, Payouts) remain registered launch scope with safe default disabled/pending states.*
