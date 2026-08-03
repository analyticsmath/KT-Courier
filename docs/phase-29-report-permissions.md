# Phase 29 Report Permission & Access Control Matrix

## Role Permission Mapping

| Role | Access Level | Granted Report Definition Keys |
| --- | --- | --- |
| `CUSTOMER` | Self-Service | `customer-courier-orders`, `customer-payments`, `customer-marketplace-orders`, `customer-personal-data` |
| `STORE` | Store Owner / Operator | `store-orders`, `store-earnings`, `store-products-catalog` |
| `DRIVER` | Driver / Courier | `driver-assignments`, `driver-earnings` |
| `PROMOTER` | Affiliate / Promoter | `promoter-referrals`, `promoter-earnings` |
| `DEVELOPER` | API Integrator | `developer-api-usage` |
| `ADMIN` | Platform Administrator | All definitions including `admin-order-volume`, `admin-payfast-reconciliation`, `admin-financial-reconciliation`, `admin-recruitment-pipeline` |

## Enforcement
Permission checks are enforced twice:
1. **API Intake Gate** (`app/api/reports/route.ts`): Checks permission snapshot against definition requirements.
2. **Job Execution Gate** (`lib/reporting/services.ts`): Re-evaluates permission snapshot at execution time.
