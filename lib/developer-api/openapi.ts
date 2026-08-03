import staticContract from "@/openapi/kt-couriers-v1.json";
import {
  PublicOrderCancelRequestSchema,
  PublicOrderRequestSchema,
  PublicQuoteRequestSchema,
  PublicStoreOrderAcceptRequestSchema,
  PublicStoreOrderReadyRequestSchema,
  PublicStoreOrderRejectRequestSchema,
  PublicWebhookCreateRequestSchema,
  PublicWebhookPatchRequestSchema,
} from "./schemas";

export const OPENAPI_VERSION = "3.1.2" as const;

/**
 * Runtime serves this checked-in JSON unchanged.  Keeping the operation list
 * separately means a deleted route or an accidental extra method fails the
 * executable parity audit instead of silently redefining the public contract.
 */
export const PUBLIC_API_ROUTE_MANIFEST = Object.freeze({
  "/": ["get"], "/service-areas": ["get"], "/quotes": ["post"], "/orders": ["get", "post"], "/orders/{reference}": ["get"], "/orders/{reference}/cancel": ["post"], "/orders/{reference}/tracking": ["get"], "/catalog/products": ["get"], "/catalog/products/{reference}": ["get"], "/store-orders": ["get"], "/store-orders/{reference}": ["get"], "/store-orders/{reference}/accept": ["post"], "/store-orders/{reference}/reject": ["post"], "/store-orders/{reference}/ready": ["post"], "/webhooks": ["get", "post"], "/webhooks/{reference}": ["get", "patch", "delete"], "/webhooks/{reference}/verify": ["post"], "/webhooks/{reference}/rotate-secret": ["post"], "/webhooks/{reference}/deliveries": ["get"], "/webhooks/{reference}/deliveries/{deliveryReference}": ["get"], "/webhooks/{reference}/deliveries/{deliveryReference}/retry": ["post"],
} as const);

/** Runtime validators and their checked-in OpenAPI schema authorities. */
export const OPENAPI_SCHEMA_AUDIT = Object.freeze({
  QuoteRequest: Object.freeze({ runtime: PublicQuoteRequestSchema, openapi: "#/components/schemas/QuoteRequest", strict: true }),
  OrderRequest: Object.freeze({ runtime: PublicOrderRequestSchema, openapi: "#/components/schemas/OrderRequest", strict: true }),
  OrderCancelRequest: Object.freeze({ runtime: PublicOrderCancelRequestSchema, openapi: "#/components/schemas/OrderCancelRequest", strict: true }),
  StoreOrderAcceptRequest: Object.freeze({ runtime: PublicStoreOrderAcceptRequestSchema, openapi: "#/components/schemas/StoreOrderAcceptRequest", strict: true }),
  StoreOrderRejectRequest: Object.freeze({ runtime: PublicStoreOrderRejectRequestSchema, openapi: "#/components/schemas/StoreOrderRejectRequest", strict: true }),
  StoreOrderReadyRequest: Object.freeze({ runtime: PublicStoreOrderReadyRequestSchema, openapi: "#/components/schemas/StoreOrderReadyRequest", strict: true }),
  WebhookCreateRequest: Object.freeze({ runtime: PublicWebhookCreateRequestSchema, openapi: "#/components/schemas/WebhookCreateRequest", strict: true }),
  WebhookPatchRequest: Object.freeze({ runtime: PublicWebhookPatchRequestSchema, openapi: "#/components/schemas/WebhookPatchRequest", strict: true }),
});

export const developerOpenApiDocument = Object.freeze(staticContract);
export function openApiJson(): string { return JSON.stringify(developerOpenApiDocument, null, 2); }
