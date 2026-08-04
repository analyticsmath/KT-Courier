# KT Couriers — Actor & Capability Matrix

| Role | Description | Self-Registration | Primary Capabilities | Permission Gating |
| :--- | :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | System Super Administrator | Denied | Full platform, permissions, ledger, system configuration | Unrestricted System Access |
| **`ADMIN`** | Operations Administrator | Denied | Order management, driver dispatch, withdrawals, dispute resolution | Permission Key Gated |
| **`STORE`** | Merchant / Store Owner | Public Allowed | Catalog management, promotions, ad campaigns, store earnings | Store Ownership Gated |
| **`CUSTOMER`** | Marketplace Buyer / Sender | Public Allowed | Cart, checkout, order creation, order tracking, address book | Account Ownership Gated |
| **`DRIVER`** | Delivery Partner | Denied (Application Only) | Availability, order accept/reject, custody, POD, driver earnings | Driver Profile & Assignment Gated |
| **`PROMOTER`** | Affiliate Marketing Partner | Denied (Application Only) | Promoter codes, referral attributions, promoter earnings | Promoter Profile Gated |
| **`EMPLOYEE`** | Staff Member | Denied | Delegated operations based on assigned system permissions | RolePermission Gated |
| **`APPLICANT`** | Driver/Promoter Applicant | Denied (Public Onboarding) | Onboarding applications, document submission | Applicant Profile Gated |
| **`DEVELOPER`** | External Business Developer | Public Allowed | API applications, HMAC keys, webhooks, sandbox API usage | API Client Scope Gated |
