# Owner-approved Gauteng coverage — 14 October 2026

The owner selected **“Entire Gauteng province”** when asked which coverage model the client intends, then instructed **“continue”**. This explicit later decision supersedes the earlier assumption that city-radius boundaries must be supplied before Gauteng coverage can be configured. The owner’s local date was 14 October 2026; the UTC date was 13 October.

The approved scope is every verified pickup and destination in Gauteng. It does not include other provinces or introduce a city radius, an invented maximum road distance, a new surcharge, a delivery guarantee, a commission schedule or a COD limit.

The additive region coverage mode defaults every existing region to `RADIUS`. An explicitly configured `PROVINCE` region is matched using server-side reverse geocoding of coordinates: South Africa (`ZA`) and the canonical province must both be affirmed. Shopper-entered province labels never establish eligibility. Unresolved, foreign or ambiguous provider results remain unavailable. Verified road routing, parcel acceptance, service/province restrictions, explicit optional road-distance limits, configured tariffs and payment checks still apply.

The one-time audited initializer activates a separate `gauteng-province-wide` region only when `KT_OWNER_APPROVED_GAUTENG_COVERAGE=OWNER_APPROVED_2026_10_14_ENTIRE_GAUTENG`. It preserves existing region records and refuses conflicting operator configuration. After activation the flag may be cleared; ongoing coverage is controlled by the canonical admin region configuration. Disabling the region stops new eligibility.

Provider reference: https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-reverse-geocoding

Activation must be followed by live quote checks within Johannesburg, Pretoria and a Gauteng location beyond the former city-radius assumptions, plus negative checks for a neighbouring province. A real card charge, refund or physical courier delivery is not established by the coverage activation or an isolated test.
