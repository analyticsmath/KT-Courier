# KT Couriers — Domain Ownership & Identifier Mapping

| Entity | Primary Key | Owner Reference | Distinct From User.id | Resolution Helper |
| :--- | :--- | :--- | :--- | :--- |
| **`User`** | `User.id` (CUID) | Self (`id`) | N/A | `getCurrentUser()` |
| **`Store`** | `Store.id` (CUID) | `Store.ownerUserId` -> `User.id` | **YES** | `getStoreForUser(userId)` |
| **`CustomerProfile`** | `CustomerProfile.id` | `CustomerProfile.userId` -> `User.id` | **YES** | `prisma.customerProfile.findUnique` |
| **`DriverProfile`** | `DriverProfile.id` | `DriverProfile.userId` -> `User.id` | **YES** | `prisma.driverProfile.findUnique` |
| **`PromoterProfile`** | `PromoterProfile.id` | `PromoterProfile.userId` -> `User.id` | **YES** | `prisma.promoterProfile.findUnique` |
| **`DeveloperApplication`** | `DeveloperApplication.id` | `DeveloperApplication.ownerUserId` | **YES** | `prisma.developerApplication.findFirst` |

## Confirmed & Repaired Store ID Defect (DEF-STORE-ID-01)
- **Defective Pattern:** Previously, store ad campaign and promotion routes passed `session.id` (`User.id`) directly into queries expecting `Store.id`.
- **Repaired Implementation:** Routes now resolve `store = await getStoreForUser(session.id)` server-side and pass `store.id` into store-domain services.
