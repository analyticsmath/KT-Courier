# KT Couriers Production-Lock Matrix

| Production Lock Feature | Source File | Current Value | Protected Operations | Evidence Completed | External Dependency | Remaining Defect | Recommended Activation |
|---|---|---|---|---|---|---|---|
| Reporting Production Validation Lock | `lib/reporting/contracts.ts` | `false` | Asynchronous report export worker execution | Phase 29 & Phase 30 full evidence suite complete | None | None | Keep `false` until final user deployment sign-off |
| PayFast Production Payment Gate | `lib/payments/payfast-provider.ts` | `false` | Live PayFast gateway API requests | Provider simulation and signed callback verified | Live PayFast Merchant Credentials | External API keys required | Keep `false` until production credentials installed |
| Twilio SMS / Push Production Gate | `lib/notifications/sms-provider.ts` | `false` | Real cellular SMS transmission | Local outbox and preference suppression verified | Twilio Account SID & Token | External API keys required | Keep `false` until production credentials installed |
| Google Maps Distance API Gate | `lib/maps/google-maps-provider.ts` | `false` | Live Google Maps Geocoding API | Seeded Cape Town coordinates and local distance math verified | Google Maps Platform API Key | External API key required | Keep `false` until production key installed |
