# Phase 28 API versioning

The public contract uses `/api/v1`. Additive changes may remain in v1; removal, semantic changes, narrowing enums, required additions, authentication, pagination and filter changes require a new major. Deprecated endpoints must emit `Deprecation`, `Sunset`, and `Link` headers.
