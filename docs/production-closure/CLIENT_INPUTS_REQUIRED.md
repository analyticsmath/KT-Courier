# Client and operations decision record

Last reconciled: 16 October 2026. The two priority website and delivery documents take precedence where documents conflict. Later explicit owner decisions are recorded in `docs/client-authority/2026-10/` and this repository. This file lists only outstanding inputs; approved values are no longer presented as blank templates.

## Approved and configured

| Decision | Current authority and scope |
|---|---|
| Coverage | The owner approved **entire Gauteng province** on 14 October. A province label alone does not make an address serviceable; verified origin/destination, reverse geocoding, route, service, capacity and active pricing checks still apply. Other provinces were not approved. |
| Parcel acceptance limits | SMALL 30×20×10 cm / 5 kg; MEDIUM 50×40×30 cm / 15 kg; LARGE 70×50×50 cm / 30 kg. Canonical v2 profiles are active in production. These acceptance caps do not supply measurements for individual vendor products or multi-item packing. |
| Marketplace courier tariffs | The owner selected the existing courier tariffs. Production audit confirms active Gauteng versions: Economy SMALL/MEDIUM/LARGE R89/R129/R179 (3–4 business days); Standard R129/R179/R249 (1–2 business days); Express R5.50 per km plus fixed SMALL/MEDIUM/LARGE R5.50/R8.50/R13 (same day subject to capacity). Scheduled is a booking qualifier, not a separate speed tariff. Do not infer VAT, risk surcharges or service guarantees. |
| Default commission rules | Where no negotiated term exists, the owner approved the documented defaults: driver 70% / KT 30%, and store/vendor 8%. Existing negotiated agreements take precedence. Values still require the correct finance/admin review and settlement acceptance before any production accrual or payout is enabled. |
| Initial COD split | The owner-confirmed starting model is 50% digital / 50% driver cash. This split alone does not authorize a COD transaction or deposit. |

## Still required for live operations

- **Store-order operating policy:** The sole production policy is a draft and is not an approved operating instruction. The owner/operations team must set vendor response and preparation windows, customer decision timeout, extension/issue limits and substitution handling. The worker currently retries 25 paid marketplace store-order candidates because no active bounded policy is available. Keep these orders blocked until a real policy is reviewed and activated.
- **Vendor catalog evidence:** Each vendor must confirm actual product dimensions/weights, packaging, stock and authenticity. QA must verify mixed-basket packing, any parcel class used, price/stock changes and courier dispatch propagation. Unsupported aggregate packages must continue to fail closed.
- **Cash and finance controls:** Define eligible stores/services/regions, maximum cash exposure, per-order limits, custody/deposit procedure, secure bank-instruction version and settlement timing. Use separate authorized authors/reviewers through the governed surfaces. No bank details belong in this file, Git or chat. Refunds, payouts and settlement need their own real-money bounds and provider evidence.
- **Commission and tax administration:** Apply the approved defaults only where no store-specific term exists; verify actual contracts, bases, VAT/tax treatment, effective dates, maker/checker identities and settlement evidence.
- **Notifications:** Approve actual templates and recipient policies, publish them through distinct actors, activate event routes and verify delivery, suppression and contact-revocation behavior with genuine recipients.
- **Driver and delivery acceptance:** Review genuine driver identity/licence, vehicle documents, service region and availability. Production currently has 25 driver profiles and zero dispatch-ready before capacity checks. Complete a real customer/vendor/driver route with pickup, consented GPS, OTP, proof of delivery and tracking.
- **Media and accessibility:** Verify private media provider behavior with authorized accounts and devices; complete camera/upload, location permission, privacy/retention, keyboard, assistive technology and viewport review. Automated fixtures do not substitute for these exercises.
- **Legal and provider details:** Supply the registered street/business address only through the required controlled disclosure surface; obtain any required counsel review. `info@ktcouriers.com` is an email address, not a physical address.

Subscriptions, promoter payouts, paid advertising and recruitment remain inactive optional commercial programs. They are outside the current delivery and marketplace launch scope; do not activate their existing scaffolds or infer commercial terms.
