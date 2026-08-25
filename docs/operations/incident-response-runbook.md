# KT-Courier — Incident Response & Kill Switches Runbook

## 1. Operational Kill Switches

All kill switches fail safely without corrupting in-flight orders or dropping confirmed webhook events:

| Switch | Environment / Setting | Safe Behavior When Triggered |
| :--- | :--- | :--- |
| **Public Checkout Kill Switch** | `CHECKOUT_PUBLIC_ENABLED="false"` | Prevents new payment sessions from starting; webhook processing and existing paid orders continue processing normally. |
| **Transactional Email Delivery** | `EMAIL_PROVIDER="console"` | Queues email intents to notification authority without external API dispatch. |
| **Notification Delivery Gate** | `NOTIFICATION_DELIVERY_ENABLED="false"` | Locks external notification dispatch while retaining message intents in database. |
| **Developer Webhook Dispatch** | `DEVELOPER_API_ENDPOINT_ENVIRONMENT="TEST"` | Blocks live webhook calls to third-party endpoints. |
| **Demo Seed Protection** | `KT_ALLOW_DEMO_SEED="false"` | Hard blocker at application startup against loading test/demo accounts in production. |

---

## 2. Fast Incident Playbooks

### 2.1 PayFast Payment Gateway Outage
1. Set `CHECKOUT_PUBLIC_ENABLED="false"`.
2. Keep `worker` running: incoming ITN webhooks already received will continue to verify and settle.
3. Monitor `/admin/reconciliation` for payments requiring manual confirmation after PayFast recovery.

### 2.2 Redis Degradation / Outage
1. Distributed rate limiting fails closed in production for sensitive auth endpoints (`LOGIN`, `SIGNUP`, `DRIVER_LOCATION`).
2. Restore or restart Redis container: `docker compose restart redis`.
3. Non-critical web traffic continues serving without data loss.

### 2.3 Background Worker Backlog
1. Check `PaymentVerifiedEventConsumerReceipt` for stuck `PROCESSING` leases (> 5 minutes).
2. Expired leases are automatically reclaimed on the next cycle by `consumeVerifiedPaymentEvents`.
3. Scale worker replicas if needed: `docker compose up -d --scale worker=2`.
