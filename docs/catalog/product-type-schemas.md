# Product-type schemas

Each `ProductTypeDefinition` is uniquely versioned by `(code, versionNumber)` and stores reviewed JSON objects for attributes, variants, compliance, and search facets. Supported attribute types are text, long text, integer, decimal, Boolean, date, enum, multi-enum, measurement, colour, and HTTPS URL.

Definitions have bounded codes, labels, ranges, enum options, display order, and conservative regular expressions. Backreferences, lookarounds, oversized patterns, duplicate codes, arbitrary executable expressions, and non-object schema roots are rejected. Attribute values reject unknown keys and validate required/type/range/options/unit rules.

Lifecycle: `DRAFT → UNDER_REVIEW → APPROVED → ACTIVE → RETIRED`; rejected definitions may return to draft. Active schema fields are database-immutable. Changes require a new definition linked with `supersedesDefinitionId`. Activation is source-locked until Phase 26.5.

