# Storefront domain model

`StorefrontProductDocument` is one product-variant-offer snapshot projection.
It stores public references, source publication version, exact VAT-inclusive
ZAR price, bounded availability, approved attributes and safe media reference.
It never stores a storage key, private stock count, moderation fields or person
data. Store and category documents are independent read projections. Collections
are editorial references only and cannot alter price or availability.

