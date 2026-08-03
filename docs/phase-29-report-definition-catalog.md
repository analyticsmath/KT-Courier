# Phase 29 Report Definition Catalog

| Report Key | Name | Audience | Permission Required | Max Rows | PII Policy |
| --- | --- | --- | --- | --- | --- |
| `customer-courier-orders` | Courier Delivery History | CUSTOMER | `report.read_own` | 1,000 | MINIMIZED |
| `customer-payments` | Payment History | CUSTOMER | `report.read_own` | 1,000 | MINIMIZED |
| `customer-marketplace-orders` | Marketplace Orders | CUSTOMER | `report.read_own` | 1,000 | MINIMIZED |
| `customer-personal-data` | POPIA Personal Data Export | CUSTOMER | `report.read_own` | 500 | FULL_AUDITED |
| `store-orders` | Store Order History | STORE | `store_report.read` | 5,000 | MINIMIZED |
| `store-earnings` | Store Earnings & Commission | STORE | `store_report.read` | 5,000 | MINIMIZED |
| `store-products-catalog` | Product Catalog Inventory | STORE | `store_report.read` | 5,000 | MINIMIZED |
| `driver-assignments` | Driver Delivery Assignments | DRIVER | `driver_report.read_own` | 2,000 | MINIMIZED |
| `driver-earnings` | Driver Earnings & Statements | DRIVER | `driver_report.read_own` | 2,000 | MINIMIZED |
| `promoter-referrals` | Promoter Referrals & Attributions | PROMOTER | `promoter_report.read_own` | 2,000 | MINIMIZED |
| `promoter-earnings` | Promoter Earnings | PROMOTER | `promoter_report.read_own` | 2,000 | MINIMIZED |
| `developer-api-usage` | Developer API Quota & Usage | DEVELOPER | `developer_report.read_own` | 2,000 | MINIMIZED |
| `admin-order-volume` | Platform Order Volume | ADMIN | `report_job.read` | 10,000 | ANONYMIZED |
| `admin-payfast-reconciliation` | PayFast Payment Reconciliation | ADMIN | `report_reconciliation.read` | 10,000 | ANONYMIZED |
| `admin-financial-reconciliation` | Financial Ledger Integrity | ADMIN | `report_reconciliation.read` | 10,000 | ANONYMIZED |
| `admin-recruitment-pipeline` | Recruitment Pipeline Audit | ADMIN | `report_job.read` | 5,000 | ANONYMIZED |
