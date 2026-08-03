# Driver earning accounting

The canonical owner is `DriverProfile.id`; the wallet key is `(DRIVER, DriverProfile.id, ZAR)`. `DRIVER_EARNINGS_PAYABLE` is an active, non-negative liability with a credit normal side and zero opening balance. It is separate from `OWNER_WITHDRAWABLE`.

- Accrual: debit platform `HELD`; credit driver `DRIVER_EARNINGS_PAYABLE` for exact net earning.
- Release: debit driver payable; credit the same wallet's `OWNER_WITHDRAWABLE` for `amount - refunded - reversed - released`, with zero reservation.
- Reversal: debit driver payable; credit platform `HELD` for remaining unreleased entitlement.

None of these journals touches cash clearing or legacy wallet balance columns. Immutable journals and entries are the monetary source; aggregate projection fields are checked against those records and refund allocations.
