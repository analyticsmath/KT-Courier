# KT Couriers — transactional email experience and launch controls

**Scope:** email appearance, sender safety, canonical event-to-recipient delivery.
**Feature branch:** `feat/transactional-email-experience`
**Production policy:** no forced activation; do not manufacture approvals, delivery receipts or customer addresses.

## Design direction

- Source of truth: `DESIGN.md` and the existing assets at `public/images/kt-couriers/brand/`.
- Pure white #FFFFFF as the reading canvas; neutral gray #F4F4F4 around the 600px table email; ink #191919; supporting copy #595959; action #982C35. Logo retains supplied colors.
- Reject cream, ivory, beige, gradients, glows, faux dashboards and generic blue status panels.
- Real logo at `https://www.ktcouriers.com/images/kt-couriers/brand/icon-192.png` with text fallback. Header emphasizes KT COURIERS; concise headline; direct explanation; single primary CTA; service links; charcoal footer and "From checkout to doorstep." brand line.
- Use email-safe semantic text, inline styles, presentational tables, 600px max width, readable type and spacing, a one-column mobile layout, alt text, and a genuine plain-text MIME alternative. No external font, CSS animation, SVG-only logo, heavy hero illustration or arbitrary redirects.
- Security emails are deliberately functional and non-promotional; avoid putting security codes or customer addresses into preheaders, analytics, URLs or notification audit tables. Marketing emails require separate consent/unsubscribe process and should **not** piggyback on transactional notifications.

## Confirmed existing event responsibilities

| Event family | Exact recipient rule | Current source/route |
| --- | --- | --- |
| Registration verification code | The registering account's email, under explicit bootstrap exception | `AUTHENTICATION_SECURITY / EMAIL_VERIFICATION_OTP` |
| Guest checkout verification code | The verified guest checkout contact snapshot | `AUTHENTICATION_SECURITY / GUEST_CHECKOUT_EMAIL_VERIFICATION_OTP` |
| First verified-account welcome | That active, verified customer, vendor or other account owner | **Added:** `ACCOUNT / ACCOUNT_EMAIL_VERIFIED` |
| Password reset / change | Account security recipient, not a guessed email | `AUTHENTICATION_SECURITY` |
| Delivery confirmation OTP | The current delivery-recipient authority, with assignment/code validity rechecked | `AUTHENTICATION_SECURITY / DELIVERY_OTP` |
| Courier booking confirmation and statuses | Owner of the canonical courier order | `LEGACY_ORDER / ORDER_CONFIRMED, ORDER_STATUS_CHANGED` |
| Marketplace order confirmation | Account customer or verified guest contact | `MARKETPLACE / MARKETPLACE_ORDER_CONFIRMED` |
| New paid store order | Active store owner only | `STORE_ORDERS / STORE_ORDER_RECEIVED` |
| Store accepted/rejected/preparation/handoff | Customer or verified guest contact | `STORE_ORDERS / STORE_ORDER_* and PREPARATION_*` |
| Courier driver assigned / picked up / in transit / attempt / delivered / failed | Customer or verified guest contact of the linked marketplace checkout | `STORE_ORDERS / COURIER_*` |
| Verified payment outcome, payment failure and refund statuses | Canonical payer/refund owner, with ledger checks | `PAYMENT, REFUND` |
| Driver assignment / vendor or driver earnings / withdrawal | Current role-authorized owner | `DISPATCH, WITHDRAWAL, STORE_EARNINGS, DRIVER_EARNINGS` |
| Conversations | Current conversation member; body contents are never sent over email | `CONVERSATION / CONVERSATION_MESSAGE_RECEIVED` |

The intent registry is not proof of production delivery. The reviewer must verify an **ACTIVE** category, **PUBLISHED** template version and **ACTIVE** route version for each family, plus recipient preferences, worker processing, Resend acceptance, and provider delivery receipts. Operational statuses must reflect canonical events; do not invent ETAs or mark payment confirmed merely because an order was placed.

## Implemented in this branch

1. Real email HTML renderer shared by legacy security and canonical queued emails, with brand assets, mobile layout, functional calls-to-action and plain-text fallbacks.
2. HTML output from canonical delivery now passes to the existing Resend adapter rather than sending only plain text.
3. Guest checkout security OTP gets the same branded HTML, preserving its privacy/identity checks and plaintext.
4. Dynamic legacy fields are HTML escaped. Untrusted outbound CTA targets are rejected.
5. Verified customer/vendor account welcome is appended once and atomically with the first successful verification. The immutable event identifies its owner by account ID, never a client-supplied address.
6. Narrow unit tests cover logo, accessibility structure, XSS escaping, trusted links, canonical tracking CTA, OTP fidelity, welcome replay and active-account evidence.

## Outstanding release gates and known limitations

1. **Brand screenshot/client QA:** inspect delivered HTML in Gmail, Outlook desktop/web and common iOS/Android clients, including images disabled and narrow widths. Browser/email-client proofs not yet recorded; the generic static renderer alone is not this proof.
2. **Domain/provider:** verify SPF, DKIM and DMARC alignment, approved From/reply-to domain, Resend suppression/bounce/complaint webhooks, and a controlled real test inbox. Never expose API keys.
3. **Notification approval:** create/approve/publish/activate the new ACCOUNT welcome category/template/route using distinct authorized reviewer/publisher accounts and legitimate audit logs. Existing event routes require the same checks. Merely committing code does not activate database records.
4. **Production gate:** `NOTIFICATION_PRODUCTION_VALIDATION_APPROVED` must stay fail-closed until validated by an authorized operator. The sender `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` and durable worker schedule must be verified on the *selected* production Render service. Do not flip the flag until all acceptance tests pass.
5. **Admin copies:** marketplace store-order event currently targets vendor or customer; a separate administrator-permission-verified source/recipient model must be designed before adding an admin carbon-copy event. Never broadcast sensitive orders to all admin-role emails by a best-guess query.
6. **Tracking reference:** order references are present in canonical notification text. The /track page enforces account ownership; its tracking number format differs from some marketplace store-order IDs. Do not invent a parcel tracking number, ETA or public route for a checkout with no courier order.
7. **Operational proof:** execute and capture verified registration/customer/vendor, checkout payment, store acceptance, handoff, driver pickup/transit/failed/delivered/POD, OTP, bounced delivery, resend and idempotency E2E tests using authorized staging entities. No live side-effects should be simulated as proof.

## Acceptance criteria

- Every actual external email sent from either security or canonical delivery includes the verified KT mark, accessible header/body/CTA/footer, and a plain-text alternative.
- Malicious HTML in names, subjects, addresses, statuses and user messages never becomes markup; action links never point off verified KT-controlled hosts.
- Only a genuinely verified/active account receives the new welcome once; customer and store roles are eligible.
- Email processes preserve immutable event intents, recipient ownership, channel preferences, outbox idempotency and provider receipts.
- Live send is enabled only after explicit production checks and governance approvals. Until then, this branch is a **code implementation**, not a production-deliverability certification.
