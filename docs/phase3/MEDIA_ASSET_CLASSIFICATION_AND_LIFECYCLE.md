# Media and document classification

Public catalog and storefront media, user profile imagery, private identity/vehicle evidence and delivery evidence have different access requirements. Existing source policies distinguish public display assets from privately authorized documents and use owner checks, signed access and upload validation; related tests include `tests/phase-b/private-media-vehicle-postgres.test.ts`, `tests/e2e/profile-avatar-lifecycle.spec.ts` and `tests/e2e/catalog-inventory-upload.spec.ts`.

Phase 3 makes no production storage changes and performs no user media writes. A production Cloudinary/storage lifecycle, retention period, deletion schedule, private URL review and physical-camera upload test have not been accepted by the media operator. Store and driver acceptance therefore remains open; see [security](SECURITY_AND_ACCESS_AUDIT.md) and [device evidence](DEVICE_ACCEPTANCE.md).
