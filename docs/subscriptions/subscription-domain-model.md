# Subscription domain model

`SubscriptionProgram` groups one subject family. `SubscriptionPlanVersion`
holds reviewed offer terms. `SubscriptionContract` freezes the accepted terms.
`SubscriptionBillingCycle` and `SubscriptionInvoice` record one period. The
existing `Payment` is linked by the `SUBSCRIPTION_INVOICE` subject. Paid cycles
grant period-specific `SubscriptionEntitlementGrant` records, and
`SubscriptionEntitlementUsage` is append-only non-cash evidence.
