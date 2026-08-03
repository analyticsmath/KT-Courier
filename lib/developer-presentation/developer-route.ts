export type DeveloperPortalRoute =
  | { kind: "documentation" }
  | { kind: "applications" }
  | { kind: "application-detail"; applicationReference: string }
  | { kind: "application-credentials"; applicationReference: string }
  | { kind: "application-usage"; applicationReference: string }
  | { kind: "application-request-log"; applicationReference: string }
  | { kind: "application-webhooks"; applicationReference: string }
  | { kind: "credentials" }
  | { kind: "webhooks" }
  | { kind: "webhook-detail"; webhookReference: string }
  | { kind: "webhook-deliveries"; webhookReference: string }
  | { kind: "delivery-detail"; deliveryReference: string }
  | { kind: "usage" }
  | { kind: "not-found" };

export function resolveDeveloperPortalRoute(segments: readonly string[]): DeveloperPortalRoute {
  if (segments.length === 1 && segments[0] === "documentation") return { kind: "documentation" };
  if (segments.length === 1 && segments[0] === "applications") return { kind: "applications" };
  if (segments.length === 2 && segments[0] === "applications") return { kind: "application-detail", applicationReference: segments[1] };
  if (segments.length === 3 && segments[0] === "applications" && segments[2] === "credentials") return { kind: "application-credentials", applicationReference: segments[1] };
  if (segments.length === 3 && segments[0] === "applications" && segments[2] === "usage") return { kind: "application-usage", applicationReference: segments[1] };
  if (segments.length === 3 && segments[0] === "applications" && segments[2] === "request-log") return { kind: "application-request-log", applicationReference: segments[1] };
  if (segments.length === 3 && segments[0] === "applications" && segments[2] === "webhooks") return { kind: "application-webhooks", applicationReference: segments[1] };
  if (segments.length === 1 && segments[0] === "credentials") return { kind: "credentials" };
  if (segments.length === 1 && segments[0] === "webhooks") return { kind: "webhooks" };
  if (segments.length === 2 && segments[0] === "webhooks") return { kind: "webhook-detail", webhookReference: segments[1] };
  if (segments.length === 3 && segments[0] === "webhooks" && segments[2] === "deliveries") return { kind: "webhook-deliveries", webhookReference: segments[1] };
  if (segments.length === 2 && segments[0] === "webhook-deliveries") return { kind: "delivery-detail", deliveryReference: segments[1] };
  if (segments.length === 1 && segments[0] === "usage") return { kind: "usage" };
  return { kind: "not-found" };
}
