# Client Decisions Required (Phase 2 Post-Implementation)

**Status:** `BLOCKED_EXTERNAL_APPROVAL`  
**Classification:** Business, Legal, and Operational Configuration Requirements  
**Notice:** Do **NOT** provide bank account credentials, live API keys, or private customer/driver personal data in response to this document. All approved values must be submitted through the versioned administrative console or authorized client change orders.

---

## 1. Courier Operational Coverage & Service Boundaries

Current implementation defaults storefront product visibility nationwide across South Africa, while restricting courier pickup and delivery to actively enabled, pricing-configured regions (currently Gauteng / Johannesburg / Pretoria).

**Decisions Required:**
1. **Initial Enabled Regions:** Confirm whether Phase 2 production launch is restricted solely to Gauteng, or if specific metropolitan areas in Western Cape (Cape Town) and KwaZulu-Natal (Durban) should be activated in the initial release.
2. **Coverage Radii & Maximum Road Distances:** For each operational hub, provide the approved maximum route distance in kilometers beyond which automated quoting refuses service.
3. **High-Risk Area Surcharges:** Specify whether any postal codes or suburbs require high-risk delivery fee adjustments, and provide the approved surcharge amount (ZAR).

---

## 2. Express Delivery Tariff & Parcel Factors

**Provenance Note:** The client specification *Delivery and Access* explicitly establishes the base rate of **R5.50/km** and mandates an applicable parcel-size component. However, the specific base amounts for parcel sizes (**Small R5.50, Medium R8.50, Large R13.00**) originate from inherited initialization code (`scripts/initialize-reviewed-client-launch.ts` / `CLIENT_REVIEW_2026_10_06`) and lack an explicit, signed commercial sign-off in client documentation. Consequently, they are classified as `INHERITED_IMPLEMENTED_UNVERIFIED` in the traceability matrix.

$$\text{Express Total} = \text{Base Fee (by Parcel Size)} + (\text{R5.50} \times \text{Distance in km})$$
- Small: R5.50 Base Fee + R5.50/km
- Medium: R8.50 Base Fee + R5.50/km
- Large: R13.00 Base Fee + R5.50/km

**Decisions Required:**
1. **Commercial Policy Approval:** Confirm whether these parcel-size base amounts (Small R5.50, Medium R8.50, Large R13.00) represent final commercial launch tariffs or require adjustment prior to live activation.
2. **Volumetric Divisor:** Confirm whether volumetric weight ($L \times W \times H / 5000$) applies to Express quotes exceeding physical weight thresholds.
3. **Same-Day Cutoff Time:** Specify the daily order cutoff time (e.g., 12:00 SAST) after which same-day Express delivery cannot be selected.

---

## 3. Registered Physical Business Address

Per client instruction, KT Couriers operates as an online courier network with **no public walk-in office**. The customer-facing business contact email is `info@ktcouriers.com`.

**Decisions Required:**
1. **Companies Act Compliance:** South African company law requires a registered office address on official tax invoices and formal legal terms. Provide the verified registered address (or formal company secretary address) to replace the current placeholder in the company profile version table.

---

## 4. Cash on Delivery (COD) Operational Policy

The system architecture implements the approved design target of **50% paid digitally / 50% collected at delivery**.

**Decisions Required:**
1. **Eligible Store Cohort:** Confirm whether COD eligibility is granted to all verified stores, or restricted to an admin-approved vendor whitelist.
2. **Maximum Cash Order Ceiling:** Specify the maximum allowable COD order value (e.g., R1,000.00 ZAR max) above which full upfront digital payment is mandatory.
3. **Driver Deposit & Remittance Timing:** Confirm driver cash deposit reconciliation timelines (e.g., within 24 hours of delivery completion).

---

## 5. Platform Commission Schedules

Client document figures (e.g., 70% driver / 30% platform split, and 8%–10% vendor commission) were provided as illustrative examples rather than immutable policies.

**Decisions Required:**
1. **Vendor Marketplace Commission:** Provide the official commission tier percentages per product category (e.g., General Retail, Food/Beverage, Electronics).
2. **Driver Delivery Remittance:** Confirm final driver earnings percentage per service tier (Economy, Standard, Express).

---

## 6. Store Advertising Packages & Social Channels

The store marketing panel supports advertising requests for TikTok, Facebook, Instagram, and Google.

**Decisions Required:**
1. **Package Tiers & Pricing:** Confirm official package names, post/story/video inclusions, campaign durations, and prices (ZAR) for commercial authoring.
2. **Managed Delivery Sourcing:** Confirm that social ad execution remains a managed administrative service rather than an automated programmatic ad placement.

---

## 7. Legal Policy Final Publication Approvals

The four core public policies (Terms & Conditions, Privacy Policy, Shipping & Delivery, and Refund & Cancellation) have been published as version `2026-10-06-client-v1` based on client-supplied DOCX documents.

**Decisions Required:**
1. **Legal Counsel Review:** Formally confirm legal counsel acceptance of the published policy texts under POPIA and the South African Consumer Protection Act (CPA).
