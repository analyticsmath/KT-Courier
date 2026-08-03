/**
 * The public site has no anonymous lookup route. Account routes remain the
 * authority for order status and their existing guard owns sign-in handling.
 */
export const anonymousTracking = {
  href: "/account/orders",
  actionLabel: "Sign in to track",
  supportingText: "Sign in to view your orders.",
} as const;
