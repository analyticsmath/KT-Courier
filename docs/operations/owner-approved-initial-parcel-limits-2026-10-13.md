# Owner-approved initial parcel limits — 13 October 2026

**Approval source:** The project owner replied "Yes i do approve" in the KT Couriers parcel-delivery conversation after requesting the empty public parcel-size selector and full delivery quote flow be made live.

**Limited scope:** Initial parcel-size acceptance limits only. This record is **not** approval of merchant Paystack/COD live charges, payouts, unknown delivery-zone boundaries, booking guarantees, or operator financial settlement.

| Stable key | Dimensions (cm) | Maximum weight (kg) |
|---|---:|---:|
| SMALL | 30 × 20 × 10 | 5 |
| MEDIUM | 50 × 40 × 30 | 15 |
| LARGE | 70 × 50 × 50 | 30 |

**Activation protocol:** `scripts/initialize-reviewed-client-launch.ts` executes `activateOwnerApprovedInitialParcelProfiles` only if the production web service has `KT_OWNER_APPROVED_PARCEL_LIMITS=OWNER_APPROVED_2026_10_13_SMALL_MEDIUM_LARGE`. A missing or mistyped flag means **no activation**. It first checks all three keys for conflicting current or future active versions and mismatched drafts. Each authorized activation uses versioned `saveParcelProfile`, an advisory transaction lock and an audit reason. Idempotent reruns do nothing if all matching versions are active. No data migration or table alteration is part of this change.

**Operator verification:** `GET /api/public/parcel-profiles` must return one effective, valid SMALL, MEDIUM and LARGE profile. Subsequently check `GET /api/public/delivery-quotes`, `GET /api/ready`, and perform a guest quote using verified route/active coverage. Successful parcel profile activation **does not guarantee a successful quote** if a delivery zone or route provider is unavailable.

**Money operations:** Live card transactions, COD capture, driver assignment, real deliveries, refunds and settlements are separate controlled actions. No dummy order should be presented as a completed live transaction.
