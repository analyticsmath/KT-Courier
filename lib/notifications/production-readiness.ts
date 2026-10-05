/**
 * Production notification delivery is an explicit release control.
 *
 * Keep the default fail-closed. Production can be enabled only after provider
 * credentials, sender-domain authentication and the security delivery path
 * have been validated in the deployed runtime.
 */
export const NOTIFICATION_PRODUCTION_VALIDATION_APPROVED =
  process.env.NOTIFICATION_PRODUCTION_VALIDATION_APPROVED === "true";

export const NOTIFICATION_PRODUCTION_BLOCK_REASON =
  "NOTIFICATION_CONSOLIDATED_VALIDATION_NOT_APPROVED";

export class NotificationProductionLockError extends Error {
  readonly code = NOTIFICATION_PRODUCTION_BLOCK_REASON;
  constructor() {
    super("Notification delivery is locked pending production validation.");
    this.name = "NotificationProductionLockError";
  }
}

export function assertNotificationProductionReady(): void {
  if (!NOTIFICATION_PRODUCTION_VALIDATION_APPROVED) {
    throw new NotificationProductionLockError();
  }
}
