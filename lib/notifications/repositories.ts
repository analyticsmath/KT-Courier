/* Prisma client generation is deliberately deferred; keep the Phase 27 adapter explicit and concrete. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPrismaNotificationRepositories(db: any) {
  return Object.freeze({
    category: db.notificationCategory, template: db.notificationTemplate, templateVersion: db.notificationTemplateVersion,
    route: db.notificationEventRoute, routeVersion: db.notificationEventRouteVersion, sourceReceipt: db.notificationSourceReceipt,
    message: db.notificationMessage, recipient: db.notificationRecipient, delivery: db.notificationDelivery,
    attempt: db.notificationDeliveryAttempt, receipt: db.notificationProviderReceipt, inbox: db.notificationInboxItem,
    preference: db.notificationPreference, consent: db.notificationConsentRecord, endpoint: db.notificationEndpoint,
    suppression: db.notificationSuppression, digest: db.notificationDigestBucket, audit: db.notificationAuditEvent,
    reconciliation: db.notificationReconciliationCase, eventIntent: db.notificationEventIntent, securePayload: db.notificationSecurePayload,
  });
}
