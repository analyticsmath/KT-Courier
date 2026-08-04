# KT Couriers — Rate Limit Policy Registry

| Operation | Max Allowance | Window | Key Dimensions | Mandatory Distributed |
| :--- | :--- | :--- | :--- | :--- |
| `LOGIN` | 10 | 10 min | IP + Normalized Email | Recommended |
| `SIGNUP` | 5 | 60 min | IP | Recommended |
| `FORGOT_PASSWORD` | 5 | 60 min | IP + Normalized Email | Recommended |
| `RESET_PASSWORD` | 10 | 15 min | IP + Token | Recommended |
| `RESEND_OTP` | 5 | 15 min | IP + User ID | Recommended |
| `VERIFY_OTP` | 10 | 15 min | IP + User ID | Recommended |
| `CATALOG_MUTATION` | 60 | 10 min | IP + Store ID | Optional |
| `MARKETPLACE_CHECKOUT` | 25 | 10 min | IP + Customer User ID | Optional |
| `DEVELOPER_API` | Quota Bounded | Day | API Client ID + Owner | Optional |

## Backend Architecture
- **In-Memory Store:** `InMemoryRateLimitStore` (sliding window for local dev, unit testing, single instance).
- **Distributed Abstraction:** `RateLimitStore` interface supported via `RateLimitService`.
- **Production Safety:** Single-instance in-memory execution emits operational diagnostic warnings (`backendUsed: "memory"`).
