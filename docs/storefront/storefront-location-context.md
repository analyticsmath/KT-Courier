# Storefront location context

Location is an optional signed cookie containing only an active coarse
`DeliveryRegion` slug and resolution state. It accepts a reviewed area or a
deterministic city/province text match; it never invokes a geocoder, stores an
address, accepts a polygon, or persists coordinates. Unknown location can browse
the general catalog. Phase 20 remains responsible for real address serviceability.

