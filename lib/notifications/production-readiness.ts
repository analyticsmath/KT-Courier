export const NOTIFICATION_PRODUCTION_VALIDATION_APPROVED = true;
export const NOTIFICATION_PRODUCTION_BLOCK_REASON = "NOTIFICATION_DELIVERY_DISABLED";

export class NotificationProductionLockError extends Error {
  readonly code = NOTIFICATION_PRODUCTION_BLOCK_REASON;
  constructor() {
    super("Notification delivery is currently disabled by policy.");
    this.name = "NotificationProductionLockError";
  }
}

export function assertNotificationProductionReady(): void {
  if (process.env.NOTIFICATION_DELIVERY_ENABLED === "false") {
    throw new NotificationProductionLockError();
  }
}
