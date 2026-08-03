# R20 administrative permission model

Role establishes admin context only. Every page retains its server `requireAdminPagePermission` guard and every action retains its API/service permission check. Navigation is a server-filtered convenience layer, never an authority boundary. `SUPER_ADMIN` continues through the existing server permission authority and is not a browser mode.

| Surface | Read | Create/update/state/destructive behavior |
| --- | --- | --- |
| Command centre | `admin.dashboard.read` | links only |
| Orders | `orders.read` | `orders.status.manage`, `dispatch.assign`, `dispatch.reassign` independently evaluated server-side |
| Dispatch/exceptions | `dispatch.read` | canonical order detail route only |
| Customers | `users.read` | no canonical R20 detail or account-state route |
| Stores | `stores.read` | no canonical R20 detail or approval route |
| Drivers | `drivers.read` | update/status/regions independently exist; full legacy console only receives the complete verified set |
| Regions | `regions.read` | `regions.manage` |
| Pricing | `pricing.read` | `pricing.manage` |
| Catalog categories/product types | `catalog_taxonomy.read` / `catalog_product_types.read` | existing taxonomy/type API remains authoritative; no create/edit route is invented |
| Catalog products/moderation/media | `catalog_moderation.read` | product and media action controls render only after server checks for review, approve, or suspend capability and source-state eligibility |
| Catalog offers/duplicates | `catalog_moderation.read` | read-only presentation in the present route tree; canonical API remains authoritative |
| Storefront collections | `storefront_collections.read` | create/item/lifecycle controls render only with `storefront_collections.manage`; public activation is omitted when locked |
| Storefront projections | `storefront_projections.read` | canonical rebuild/resolve controls render only with `storefront_projections.reconcile` |
| Storefront synonyms | `storefront_search_synonyms.read` | draft/lifecycle controls render only with `storefront_search_synonyms.manage`; public activation is omitted when locked |
| Marketplace checkout | `marketplace_checkout.read` | protected locked state; no R20 mutation |
| Store-order reconciliation | `store_orders.reconcile` | operational read-only triage; no R20 financial action |

Action islands receive boolean capabilities, not raw permission keys. Missing write capability hides the action; lock/unavailable states explain real backend limitations. Regression checks must verify server route guards, navigation filtering, action non-serialization for read-only administrators, and no raw permission-key display.
