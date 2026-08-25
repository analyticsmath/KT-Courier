# KT-Courier — Secrets Management & Rotation Runbook

## 1. Production Secret Classes

| Secret Class | Environment Variable | Recommended Rotation Cadence | Zero-Downtime Strategy |
| :--- | :--- | :--- | :--- |
| **Database Credentials** | `DATABASE_URL` | 90 Days | Provision secondary DB user, update app env, revoke old user. |
| **Redis Auth** | `REDIS_URL` | 90 Days | Dual AUTH in Redis, update app env. |
| **PayFast Secret & Passphrase** | `PAYFAST_PASSPHRASE`, `PAYFAST_MERCHANT_KEY` | 180 Days | Update PayFast dashboard and app environment simultaneously. |
| **Outbound Email** | `RESEND_API_KEY` | 180 Days | Create new API key in Resend dashboard, deploy env, revoke old key. |
| **S3 Object Storage** | `PRIVATE_MEDIA_S3_SECRET_ACCESS_KEY` | 90 Days | Generate second IAM key pair in S3 provider, deploy env, delete old key. |
| **Developer API HMAC** | `DEVELOPER_API_CREDENTIAL_HMAC_KEY` | 365 Days | Versioned key transition. |
| **Webhook Encryption** | `DEVELOPER_WEBHOOK_ENCRYPTION_KEY` | 365 Days | Versioned key transition. |
| **Server Actions Key** | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Per Release / 90 Days | Set uniform key across all application replicas. |
| **Internal Cron Secret** | `CRON_SECRET` | 180 Days | Update in scheduler and web app env. |

---

## 2. Zero-Downtime Secret Rotation Procedure

1. **Generate Cryptographically Secure Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. **Inject into Staging / Deployment Manager**: Update environment variables without altering codebase.
3. **Trigger Rolling Restart**: Restart web, worker, and scheduler services.
4. **Audit Readiness**: Inspect `/api/ready` to confirm all services re-authenticated successfully.
