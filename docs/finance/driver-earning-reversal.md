# Driver earning reversal

Finance reversal accepts only the seven bounded reason codes, a valid operation ID, bounded safe note and an opaque authoritative evidence reference. Amount, account, wallet, driver, status, ledger direction and replacement settlement are not inputs.

Only accrued or reviewed reconciliation-required, unreleased, unreserved remaining entitlement may reverse. Related attributed Phase 14 commission must already be canonically reversed; otherwise the service opens reconciliation and does not post. The serializable transaction posts payable debit/held credit, records journal, reason/evidence and history, and resolves only restored reconciliation. It never recalculates commission policy.
