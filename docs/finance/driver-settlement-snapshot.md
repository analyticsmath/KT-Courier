# Driver settlement snapshot

The internal snapshot binds subject, assignment ID/opaque reference/version, driver ID/code/wallet, order/payment references, settlement/calculation versions, opaque completion evidence, service/authority/release timestamps, exact basis/commission/net and sorted commission charges.

It requires `basis - commission = net > 0` and charge sum equal to commission. The resolver locks and rechecks the completed assignment, matching driver/order/version, same-assignment POD and completion events, verified successful ZAR payment, canonical wallet/account and related accrued commission allocations. Payment total and UI status are never calculation inputs.

No customer identity/contact/address, GPS trace, POD image/signature, bank data, credential, provider payload or secret enters the snapshot/hash. Reassignments are distinct: a superseded assignment cannot inherit the completing assignment's entitlement.
