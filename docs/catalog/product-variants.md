# Product variants

Every product is created with at least one default variant. Option-bearing variants use normalized, code-sorted option selections hashed with SHA-256. `(productId, optionFingerprint)` is unique.

GTIN-8, UPC/GTIN-12, EAN/GTIN-13, and GTIN-14 use exact GS1 modulo-10 check digits. Values are normalized to digits, all-zero placeholders are rejected, and GTIN is globally unique. MPN is normalized uppercase and evaluated with brand for duplicate signals; store SKU is normalized and unique inside the store.

Option definitions support text, colour swatch, image swatch, and size presentations. Values use plain text/safe swatches and owned asset references—never arbitrary HTML.

