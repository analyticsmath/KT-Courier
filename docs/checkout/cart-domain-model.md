# Cart domain model

`MarketplaceCart` is mutable intent only. It is owned by either an authenticated
customer or a hashed guest secret, groups lines per store, uses optimistic
versions and operation receipts, and never reserves inventory or becomes payment
evidence. Legacy `Cart` and `CartItem` remain dormant compatibility records.
