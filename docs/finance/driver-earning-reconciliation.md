# Driver earning reconciliation

Twenty bounded reasons cover assignment/version mismatch, missing/conflicting completion, settlement/commission/ledger/refund mismatches, duplicates, incidents, release/reversal conflicts, account mismatch, staleness and application failure. States are OPEN, MONITORING, RESOLVED and CLOSED.

Case keys are deterministic; repeat scans increment observation count. Opening a case can move an accrued earning to reconciliation-required. Resolution requires restored financial invariants and a canonical operation reference, then restores accrued state only when no open cases remain. Reconciliation never edits an amount, balance, assignment, delivery, status marker or ledger direction and never provides a manual financial override.
