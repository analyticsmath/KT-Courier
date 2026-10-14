# Owner-selected commission defaults

On 14 October 2026 the owner instructed: "do as per documents if they're not there then 8%". The newer Delivery and Access document describes a configurable 70% driver / 30% KT split and an illustrative 8–10% vendor range. Use 8% for initial vendor drafts where there are no existing store terms. These are versioned policies in the existing commission editor, excluding marketplace delivery fees from the vendor basis.

The initializer prepares a 30% platform courier commission and an 8% platform commission for each currently ACTIVE store with no prior commission version. Driver settlement retains the residual 70% of the courier subtotal basis under the existing settlement calculation. Existing policies in any state are preserved. No approval, financial accrual, charge or payout is created by this preparation.

One-time opt-in: `KT_OWNER_SELECTED_COMMISSION_DEFAULTS=OWNER_SELECTED_DOCUMENTS_OR_8_PERCENT_2026_10_14`. The initializer uses a transaction, advisory lock and audit records; repeat execution does not create additional versions. Clear the flag after verifying the preparation event.

An actual authorized administrator must submit the editable draft and a different authorized administrator must review it through the existing workflow. Source validation locks are a separate release concern; this initializer does not bypass them. Newly approved stores after this one-time run require their own policy through the editor.

The owner also selected digital payment and COD for all approved stores. A maximum COD amount and secure bank remittance configuration remain required; neither is invented by this change.

Verification: canonical commission service regression tests plus a disposable PostgreSQL test check 800 basis points, preservation of negotiated 1000 basis points, pending-store exclusion, independence of approval, absence of accrual and idempotency. No production measurements or customer orders are created.
