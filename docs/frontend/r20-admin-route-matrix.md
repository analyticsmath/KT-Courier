# R20 administrative route matrix

The R20 command-centre and core-operation routes retain the matrix recorded in the initial delivery. The concrete commerce routes below were corrected in the R20 continuation after R21 preflight found their legacy visual bodies. “Authority” names the existing service/read projection; no authority was replaced.

| Path | Authority and permission | Previous → new protected-v2 state | Mobile mode | Lock / risk | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| `/admin` | `AdminDashboardData`; `admin.dashboard.read` | protected command centre retained | queues / records | no finance queue | initial R20 focused checks |
| `/admin/orders`, `/[id]`, `/dispatch` | order/dispatch DTOs; `orders.read` / `dispatch.read` | protected operations retained | stack / detail | no map or raw location | initial R20 focused checks |
| `/admin/users`, `/stores`, `/drivers`, `/regions`, `/pricing` | existing admin DTOs; route read permissions | protected directories retained | stack | minimised account/network fields | initial R20 focused checks |
| `/admin/catalog` | catalog counts + moderation service; `catalog_moderation.read` | legacy summary → protected overview with four direct-authority summaries and attention queue | records | storefront exposure lock; no sales metrics | `r20-commerce-closure` route/import and lock checks |
| `/admin/catalog/categories` | category service; `catalog_taxonomy.read` | legacy table → `EditorialTable` | stack | no invented category editor/detail route | protected import + legacy scan |
| `/admin/catalog/product-types` | product-type service; `catalog_product_types.read` | legacy table → `EditorialTable` | stack | exposure lock; schema internals withheld | protected import + legacy scan |
| `/admin/catalog/products` | product query DTO; `catalog_moderation.read` | legacy table → filtered/paginated `EditorialTable` | stack | canonical fields; no quality/AI score | DTO/filter/status tests |
| `/admin/catalog/products/[id]` | existing server product projection; `catalog_moderation.read`, action permissions separately | legacy cards/raw JSON → protected detail, safe media/offers/history/action panel | detail route | exposure lock; no compliance JSON, storage data, or public claim | capability and sensitive-field tests |
| `/admin/catalog/moderation` | moderation service; `catalog_moderation.read` | legacy table → server-filtered `EditorialTable` | stack | safe summary/reason only | explicit status test |
| `/admin/catalog/moderation/[id]` | moderation service; `catalog_moderation.read` | legacy cards → protected detail/timeline | detail route | no private evidence or actor identity | protected import + timeline source only |
| `/admin/catalog/offers` | offer query DTO; `catalog_moderation.read` | legacy table → filtered/paginated `EditorialTable` | stack | exposure lock; no discount calculation | DTO/metric scan |
| `/admin/catalog/media` | media page service; `catalog_moderation.read` | raw table → `EditorialTable` | stack | public delivery lock; no key/provider/credential | storage-key scan |
| `/admin/catalog/media/[id]` | media page service; read + canonical review action permissions | raw detail → protected evidence/detail/history/action panels | detail route | no storage key/provider/actor identity | capability and sensitive-field tests |
| `/admin/catalog/duplicates` | duplicate service; `catalog_moderation.read` | legacy table/cards → `EditorialTable` | stack | canonical authority only; no client score/automatic merge | duplicate/source scan |
| `/admin/storefront/collections` | collection service; `storefront_collections.read/manage` | raw cards/forms → protected table and focused canonical draft form | stack | public exposure lock; no traffic/public claim | server capability + lock checks |
| `/admin/storefront/collections/[id]` | collection service; read/manage | raw detail/forms → protected detail, source-backed item list, focused item/lifecycle form | detail route | public activation omitted when locked | capability/lock checks |
| `/admin/storefront/projections` | reconciliation service; `storefront_projections.read` | raw cards → `EditorialTable` | stack | no public override/provider payload | protected import + lock scan |
| `/admin/storefront/projections/[id]` | reconciliation service; read/reconcile | raw detail → protected context and canonical-rebuild action panel | detail route | no public override/provider payload | server capability checks |
| `/admin/storefront/search-synonyms` | synonym service; `storefront_search_synonyms.read/manage` | raw cards/forms → protected table and focused deterministic draft form | stack | exposure lock; no analytics/client publication | validation/capability checks |
| `/admin/storefront/search-synonyms/[id]` | synonym service; read/manage | raw detail → protected deterministic term/lifecycle detail | detail route | public activation omitted when locked | validation/lock checks |
| `/admin/marketplace-checkout` | checkout lock readiness; `marketplace_checkout.read` | legacy card → `ProtectedState` locked surface | locked state | no activation, transaction, provider or payment UI | lock-state check |
| `/admin/store-order-reconciliation` | marketplace store-order reconciliation case; `store_orders.reconcile` | legacy raw table → protected operational `EditorialTable` | stack | no refund/ledger/payout/commission/payment work; distinct from courier orders | R20/R21 boundary test |

No category/product create, edit, or nested commerce detail page beyond the routes above exists in the actual admin tree. R20 adds none.
