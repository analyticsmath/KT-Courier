# Phase 30 External Dependencies Audit

## Third-Party Integrations & Accounts

| Integrations / Service | Purpose | Sandbox / Local Strategy | Production Requirements |
| --- | --- | --- | --- |
| **PayFast** | Payment Gateway | Local sandbox endpoint + ITN simulation | Production Merchant ID, Merchant Key, Passphrase |
| **Resend / SMTP** | Email Delivery | In-memory notification DB / local sandbox | Verified domain & live API key |
| **Twilio** | SMS Delivery | Mock SMS transport / local sandbox | Live Twilio Account SID & Auth Token |
| **Google Maps** | Distance & Geocoding | Haversine distance matrix fallback | Live Google Maps API Key with Distance Matrix & Geocoding enabled |
| **PostgreSQL** | Database | Local / Dockerized Postgres instance | Managed Postgres instance (e.g. AWS RDS / GCP Cloud SQL) |

## Dependency Health Status
All fallback logic has been tested and verified to operate smoothly without runtime crashes when credentials are absent.
