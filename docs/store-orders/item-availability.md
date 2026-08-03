# Item availability

Each immutable origin line has a mutable fulfilment record. Store staff can only confirm a bounded available quantity; partial and zero availability append an issue. Default `REFUND_IF_UNAVAILABLE` and `NO_SUBSTITUTION` create a refund-only adjustment; no line is silently removed, repriced or fulfilled unavailable.
