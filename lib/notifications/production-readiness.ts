/** Phase 27 stays fail-closed until Phase 30 validates the full runtime. */
export const NOTIFICATION_PRODUCTION_VALIDATION_APPROVED = false;
export const NOTIFICATION_PRODUCTION_BLOCK_REASON = "NOTIFICATION_CONSOLIDATED_VALIDATION_NOT_APPROVED";

export class NotificationProductionLockError extends Error {
  readonly code = NOTIFICATION_PRODUCTION_BLOCK_REASON;
  constructor() {
    super("Notification delivery is locked pending Phase 30 production validation.");
    this.name = "NotificationProductionLockError";
  }
}

export function assertNotificationProductionReady(): void {
  if (!NOTIFICATION_PRODUCTION_VALIDATION_APPROVED) throw new NotificationProductionLockError();
}
