# Legal Policy Conflict & Governance Note

**Document Status:** Pending Legal Counsel Review  
**Date:** 2026-09-13  
**Audience:** KT Courier Executive Team, Legal Counsel, Chief Architect  
**Subject:** Reconciliation of Terms & Conditions, Refund & Cancellation Policy, and Statutory Rights under the Consumer Protection Act (CPA) 68 of 2008

---

## 1. Executive Summary

During the single-pass production readiness audit of the KT Courier platform, an inconsistency was identified between the public customer-facing **Terms and Conditions** and the **Refund and Cancellation Policy**, specifically concerning customer dispute notification timeframes and statutory rights under South African consumer law.

In accordance with architectural governance directives, the engineering team has **not made unilateral changes to legal text in code**. Legal policies are versioned documents governed by legal counsel. This document records the exact nature of the conflict, identifies affected operational workflows, and provides specific recommendations for legal review.

---

## 2. Identified Inconsistencies

### 2.1. Defect & Delivery Dispute Notification Limits (Terms vs. Refund Policy vs. CPA)

* **Terms and Conditions (Section 13.3 / Dispute Notice Window):**  
  States that any dispute, non-delivery, damaged goods claim, or merchant discrepancy must be notified to KT Courier in writing within **24 hours** of the scheduled or actual delivery timestamp, failing which the order is deemed irrevocably accepted and the customer forfeits claims.
* **Refund and Cancellation Policy:**  
  States that refunds and remedies for defective, damaged, or misrepresented goods are handled in accordance with the **South African Consumer Protection Act, No. 68 of 2008 (CPA)**, recognizing the customer's right to return unsafe, defective, or non-conforming goods for refund, replacement, or repair.
* **Statutory Law Conflict (CPA Section 56):**  
  Under Section 56 of the CPA (implied warranty of quality), a consumer may return goods within **6 months** after delivery if the goods fail to satisfy the requirements of Section 55 (reasonably suitable for purpose, good quality, in good working order and free of defects). While perishable food or customized prepared meals naturally have practical freshness limitations, non-perishable marketplace retail goods and merchant merchandise cannot be contractually stripped of CPA section 56 rights through an arbitrary 24-hour guillotine clause.
* **Risk Evaluation:**  
  An unqualified 24-hour forfeiture clause risks being found unfair, unreasonable, or unjust under CPA Section 48 and prohibited under CPA Section 51 (prohibited transactions, agreements, terms, or conditions).

### 2.2. Service Tier Nomenclature Alignment

* **Issue:**  
  Marketing copy, public legal policies, and operational dispatch configurations use slightly varying terms when describing delivery tiers:
  * Policy text references: "Standard Delivery", "Express Delivery", "Same-Day Scheduled Delivery".
  * Pricing & dispatch config tables reference: `STANDARD`, `EXPRESS`, `SCHEDULED`, `CUSTOM_CORRIDOR`.
* **Remedy Required:**  
  Canonical tier definitions should be locked across both the legal contracts and the database enum tables (`DeliveryTier` / `CommercialPricingRule`) to prevent ambiguity in service-level agreement (SLA) breach claims.

### 2.3. Official Registered Physical Address for Legal Service

* **Issue:**  
  Platform legal terms currently provide contact emails (`support@ktcourier.co.za`, `legal@ktcourier.co.za`) and dynamic location references, but omit the formal physical South African registered address and `domicilium citandi et executandi` required under Section 22 and Section 43 of the Electronic Communications and Transactions Act (ECTA) 25 of 2002.
* **Remedy Required:**  
  Populate `registeredAddress` and `registrationNumber` in the canonical `CompanyProfile` model and interpolate these into the legal policy disclosures.

---

## 3. Platform Technical Posture

1. **No Silent Re-writing of Legal Terms:**  
   The platform code does not hardcode dispute rejection logic strictly at 24:00:00 hours. The dispute submission endpoint (`/api/disputes`) and refund ingestion pipeline evaluate dispute windows through configurable rules (`DisputePolicyRule`) with role-based escalation paths for customer support.
2. **Audit Logging & Idempotency:**  
   All refund requests, disputes, and cancellation transactions are recorded in immutable audit logs with timestamped snapshots of active policy versions.
3. **Company Profile Versioning:**  
   The platform maintains versioned issuer profiles (`CompanyProfileVersion`) and immutable invoice snapshots (`CompanyIssuerSnapshot`) to guarantee that legal entities and VAT registrations are auditable.

---

## 4. Required Counsel & Owner Decisions

Before releasing the next public policy revision, legal counsel and the platform owners must provide written determination on:

1. **Perishable vs. Non-Perishable Dispute Windows:**  
   Adopt a dual-tier dispute notice window:
   * **Perishable Food / Hot Meals:** Notice within 2 to 4 hours of delivery (or prior to consumption).
   * **General Retail / Packaged Goods:** Standard notice for transit damage within 48 hours; preservation of statutory CPA Section 56 warranty rights (up to 6 months for latent manufacturing defects).
2. **Standardized Delivery Tier Descriptions:**  
   Confirm exact legal definitions for `STANDARD`, `EXPRESS`, and `SCHEDULED` delivery SLAs.
3. **Formal Company Disclosure Notice:**  
   Provide the official registered company entity name, registration number, physical office address, and names of directors for inclusion in legal page footers and formal PDF statements.
