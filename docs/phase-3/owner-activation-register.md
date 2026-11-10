# Owner Activation and Commercial Signoff Register

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Branch**: `main`  
**Classification**: EXTERNAL HUMAN / COMMERCIAL PREREQUISITES (NON-CODE GATES)  
**Authority**: Product Owner / Chief Executive Officer / Financial Director  

---

## 1. Release Veto Policy

In accordance with strict Chief Architect directives and repository invariants, the coding agent has left the Phase 3 launch authorization in a **FAIL-CLOSED** state:
- `docs/production-closure/engineering-gates.json`: `NOT_READY`
- `lib/promotions/production-lock.ts`: `PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false`
- CI Workflow `production-certification.yml`: `Phase 3 live launch veto` enabled

Under no circumstances may an automated agent synthesize fake bank credentials, mock FICA approvals, or bypass this veto. The checklist below itemizes the exact operational and legal conditions the human business owner must execute before live financial release.

---

## 2. Commercial & Operational Activation Checklist

| Checkpoint ID | Domain | Prerequisite Description | Responsible Authority | Required Evidence / Artifact | Signoff Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | **Payment Gateway** | Live Paystack South African Merchant Account activation. | Financial Director | Live `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, and webhook URL `https://.../api/webhooks/paystack` configured with matching `PAYSTACK_WEBHOOK_SECRET`. | `PENDING_OWNER` |
| **ACT-02** | **Merchant Payouts** | Paystack Subaccounts & Split Payment configuration for verified merchant stores. | Financial Director | Verified bank account details and automated transfer schedules established in Paystack dashboard. | `PENDING_OWNER` |
| **ACT-03** | **Corporate Banking** | KT Couriers corporate operating bank account for driver cash collection deposits. | Managing Director | Verified South African bank account (FNB / Standard Bank / Nedbank / Absa) details loaded into `admin/cash-deposit-bank`. | `PENDING_OWNER` |
| **ACT-04** | **Store Compliance** | Initial cohort of live merchant stores verified under FICA and CIPC legal registration. | Commercial Lead | Signed Merchant Terms of Service, CIPC registration certificates, and verified physical collection addresses with GPS coordinates. | `PENDING_OWNER` |
| **ACT-05** | **Driver Verification** | Initial fleet of delivery drivers verified for road safety and statutory licensing. | Operations Lead | Valid South African Driver's License, Professional Driving Permit (PrDP), vehicle roadworthy certificates, and criminal background checks. | `PENDING_OWNER` |
| **ACT-06** | **Tax & Legal** | South African Revenue Service (SARS) VAT registration and CPA invoice disclosures. | Legal & Tax Advisor | Company VAT registration number and verified VAT tax invoice formatting on all electronic delivery receipts. | `PENDING_OWNER` |
| **ACT-07** | **Domain & DNS** | Production custom domain DNS delegation and automated SSL certificate issuance. | Lead DevOps / Owner | Custom apex and `api.` subdomains delegated to Vercel and Railway with active HSTS headers. | `PENDING_OWNER` |
| **ACT-08** | **Human Launch Order** | Formal written authorization to transition engineering gate status to `GO`. | Product Owner | Signed authorization record referencing exact commit SHA after full human smoke-test. | `PENDING_OWNER` |

---

## 3. Procedure for Lifting the Launch Veto

When all prerequisites (ACT-01 through ACT-08) have been satisfied by human operators:
1. Populate production environment secrets in Railway and Vercel dashboards (`PAYSTACK_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `CLOUDINARY_URL`, `JWT_SECRET`).
2. Run database migration verification:
   ```bash
   npx prisma migrate deploy
   ```
3. Update `docs/production-closure/engineering-gates.json` classification from `NOT_READY` to `READY` with references to the executed legal and provider agreements.
4. Update `lib/promotions/production-lock.ts` to `PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = true`.
5. Remove or pass the intentional launch veto step in `.github/workflows/production-certification.yml`.
6. Push signed release commit to `main`.
