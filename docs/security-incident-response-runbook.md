# POPIA Section 22 Security Compromise & Incident Response Runbook

**Document Owner**: Information Officer / Security Operations  
**Entity**: KT Couriers (Pty) Ltd  
**Jurisdiction**: Republic of South Africa  
**Governing Law**: Protection of Personal Information Act, 2013 (Act No. 4 of 2013) (“POPIA”), Section 22  
**Effective Date**: September 2026  
**Regulatory Baseline**: Information Regulator (South Africa) eServices Portal Mandate (Effective 1 April 2025)

---

## 1. Executive Summary & Legal Framework

Under **Section 22(1) of POPIA**, where there are reasonable grounds to believe that the personal information of a data subject has been accessed or acquired by any unauthorized person, the responsible party must notify:
1. **The Information Regulator (South Africa)**; and
2. **The affected Data Subjects**, unless the identity of such data subjects cannot be established.

### Key Regulatory Directives:
- **Mandatory eServices Submission (Effective 1 April 2025)**: As mandated by the Information Regulator, all Section 22 security compromise notifications and follow-up submissions must be submitted online through the Information Regulator’s **eServices Portal** (`https://eservices.inforegulator.org.za/`). Manual email forms are deprecated except as emergency failover.
- **Zero Low-Risk Threshold**: Unlike certain international frameworks (e.g. GDPR risk of harm threshold), **POPIA contains no low-risk materiality or de minimis threshold**. Any confirmed unauthorized access or acquisition of personal information triggers mandatory notification obligations.
- **Operator vs. Responsible Party Obligations (Section 22(2))**:
  - An **Operator** (e.g., cloud host, third-party vendor, external developer, payment provider) that processes personal information on behalf of KT Couriers must notify KT Couriers **immediately** upon suspecting or discovering an unauthorized access or acquisition.
  - **KT Couriers (Pty) Ltd is the Responsible Party** and bears the sole non-delegable statutory obligation to notify the Information Regulator and the affected data subjects.
- **Notification Timing**: Notifications must be made **as soon as reasonably possible** after the discovery of the compromise, taking into account the legitimate needs of law enforcement or any measures reasonably necessary to determine the scope of the compromise and restore the reasonable integrity of the responsible party's information system (72-hour internal benchmark).

---

## 2. Incident Classification & Severity Matrix

| Severity | Definition | Examples | SLA to Contain | Regulatory Action |
| :--- | :--- | :--- | :--- | :--- |
| **P1 - Critical Compromise** | Confirmed unauthorized extraction or access to customer/vendor personal data, banking/financial details, credentials, or administrative databases. | Database dump exfiltration, API key exposure granting production write/read access, active ransomware. | < 1 hour | Immediate Information Officer escalation; eServices portal notification within 72h. |
| **P2 - High Risk Breach** | Unauthorized access to isolated account/tenant data, broken object-level authorization (BOLA) exploitation across accounts, or unencrypted private evidence exposure. | Cross-tenant access to delivery addresses, vehicle registration discs or driver licenses exposed via storage leaks. | < 4 hours | IO assessment; eServices notification required unless definitively proven unaccessed. |
| **P3 - Contained / Operational Anomaly** | Attempted intrusion repelled by security controls, failed brute-force attacks against hashed OTPs, isolated credential stuffing blocked by rate limits. | Rate-limited OTP failure bursts, blocked SQL injection attempts in WAF/application layer. | < 24 hours | Internal security logging and remediation; periodic security audit report. |

---

## 3. Immediate Technical Containment & Evidence Preservation (Phase 1)

When an incident is detected or reported:

### 3.1 Step 1: Trigger Operational Kill Switches
Depending on the attack vector, immediately engage the verified runtime kill switches without corrupting in-flight orders or double-entry financial ledger balances:
- **Public Checkout Session Kill Switch**:
  ```bash
  # In production environment / orchestration:
  CHECKOUT_PUBLIC_ENABLED="false"
  ```
  *Stops new checkout sessions; existing confirmed orders and webhook ledger posts continue processing cleanly.*
- **Outbound Notification Kill Switch**:
  ```bash
  NOTIFICATION_DELIVERY_ENABLED="false"
  EMAIL_PROVIDER="console"
  ```
  *Prevents potential spam/phishing relays or leaked notification dispatch while preserving notification intents in durable storage.*
- **Developer Webhook Outbox Kill Switch**:
  ```bash
  DEVELOPER_API_ENDPOINT_ENVIRONMENT="TEST"
  ```
  *Halts external webhook dispatches.*

### 3.2 Step 2: Credential & Secret Revocation
If credentials or provider keys are suspected of being compromised:
1. **Paystack Secrets**:
   - Immediately rotate `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` in the Paystack Dashboard.
   - Update container environment secrets in orchestration / Compose.
   - Run `npm run test:paystack:contract` to verify the new keys connect properly.
2. **Database Credentials**:
   - Rotate database passwords.
   - Terminate active unauthorized database connection sessions:
     ```sql
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'kt_courier' AND pid <> pg_backend_pid();
     ```
3. **Admin & User Sessions**:
   - Invalidate all active user session tokens in Redis:
     ```bash
     redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'session:*')))" 0
     ```

### 3.3 Step 3: Forensic Evidence Preservation
- **Never reboot or destroy containers before snapshotting**:
  - Export Docker container logs: `docker compose logs --tail=50000 > incident_$(date +%s).log`.
  - Capture PostgreSQL WAL and current ledger audit snapshots:
    ```bash
    npm run db:verify:ledger
    npm run db:verify:payments
    ```
  - Preserve all `PrivateMediaAccessLog` and `AdminActivityLog` records in PostgreSQL.

---

## 4. Information Officer Escalation & Assessment (Phase 2)

### 4.1 Statutory Roles:
- **Responsible Party**: KT Couriers (Pty) Ltd
- **Registered Address**: 361 Pope Hennessy Street, Midrand, Gauteng, 1685, South Africa
- **Information Officer**: Appointed under Section 55 of POPIA
- **Contact Email**: Info@ktcouriers.com / legal@ktcouriers.com

### 4.2 Investigation Checklist:
1. What categories of personal information were compromised?
   - Contact details (names, email addresses, phone numbers, delivery addresses)
   - Identity numbers / Driver licenses / Vehicle registration documents
   - Financial data (note: card numbers are never stored by KT Couriers; handled directly by Paystack PCI-DSS Level 1 rail)
   - Location data / Proof of Delivery (POD) signatures / OTP records (hashed with SHA-256)
2. How many data subjects are affected? (Exact count or estimated range).
3. Who is the unauthorized person who accessed or acquired the information (if known)?
4. What is the root cause (e.g., misconfigured storage, application vulnerability, compromised operator)?

---

## 5. Information Regulator Notification Workflow (Phase 3)

### 5.1 Submission via eServices Portal
As of 1 April 2025, the submission must be made via **eServices Portal**:
1. Access `https://eservices.inforegulator.org.za/`.
2. Navigate to **Section 22 Security Compromise Notification**.
3. Complete the prescribed regulatory fields:
   - **Responsible Party Details**: KT Couriers (Pty) Ltd (Reg. No., Information Officer details).
   - **Date and Time of Compromise**: Discovery timestamp and estimated occurrence timestamp.
   - **Nature of the Security Compromise**: Vulnerability exploited or incident description.
   - **Categories and Volume of Personal Information**: Exact fields compromised.
   - **Number of Data Subjects Affected**: Enumerated count.
   - **Measures Taken or Proposed to Mitigate Damage**: Containment, key rotation, patches applied.
   - **Description of Suspected Unauthorized Persons**: If known or under SAPS investigation.
4. Upload forensic evidence, preliminary RCA, and draft communication to data subjects.
5. Record the **eServices Reference Number / Acknowledgement Receipt**.

---

## 6. Data Subject Notification Workflow (Phase 4)

Section 22(5) requires notifications to affected data subjects to provide sufficient information to allow them to take protective measures.

### 6.1 Prescribed Content of Data Subject Notice:
- A description of the incident and when it occurred.
- A description of the categories of personal information involved in the breach.
- The identity of the unauthorized person, if known.
- The measures that KT Couriers has taken to address the security compromise.
- Specific recommendations on protective measures the data subject should take (e.g., updating passwords, monitoring bank statements, heightened vigilance against phishing).
- Contact details of KT Couriers' Information Officer for questions or support.

### 6.2 Communication Channels:
- Direct email to affected registered users (primary).
- Prominent notice on KT Couriers website / mobile app if individual contact is not possible.
- SMS / WhatsApp alert for critical customer/driver account compromises.

---

## 7. Financial & Ledger Reconciliation (Phase 5)

Because KT Couriers operates an immutable double-entry ledger for all platform ZAR flows:
1. **Audit Ledger Integrity**:
   - Run the invariant verification suite: `npm run db:verify:ledger` and `npm run db:verify:payments`.
   - Verify that all ledger account balances strictly balance (`Debits == Credits`).
   - Check that no rogue withdrawal requests (`PaymentWithdrawal`) or refunds (`PaymentRefund`) were posted during the incident window.
2. **Reconcile External Paystack Balances**:
   - Reconcile Paystack balance via verified settlement reports against internal ledger `PLATFORM_PAYSTACK_SETTLEMENT` asset account.
   - For any disputed or compromised transactions, initiate formal Paystack dispute/investigation cases.

---

## 8. Post-Incident Review, Regulatory Updates & RCA (Phase 6)

1. **Follow-Up Regulatory Filings**:
   - Submit follow-up status reports through the eServices portal as forensic investigations conclude or new facts emerge.
   - Formally close the incident with the Information Regulator once all corrective actions are verified.
2. **Root Cause Analysis (RCA)**:
   - Publish a formal internal RCA within 7 calendar days detailing root cause, timeline, affected components, and permanent fixes.
3. **Policy & System Hardening**:
   - Update unit, integration, and security regression test suites (`tests/security/bola-negative-authorization.test.ts`).
   - Verify that automated CI checks prevent recurrence.
