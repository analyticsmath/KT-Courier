# Phase 27 event catalog

Only durable source intents are eligible. Repository event names include `SUBSCRIPTION_ACTIVATED`, `SUBSCRIPTION_CANCELLATION_SCHEDULED`, `PROMOTER_APPLICATION_SUBMITTED`, `PROMOTER_RECONCILIATION_REQUIRED`, `RECRUITMENT_*`, `STORE_ORDER_ACCEPTED`, `STORE_ORDER_REJECTED`, `STORE_ORDER_READY_FOR_HANDOFF`, `DELIVERY_ORDER_CREATED`, and `ORDER_CONFIRMED`/`ORDER_STATUS_CHANGED` compatibility intents. Routes are configuration, not hard-coded domain sends. An unknown event creates `EVENT_ROUTE_NOT_CONFIGURED` reconciliation evidence.
