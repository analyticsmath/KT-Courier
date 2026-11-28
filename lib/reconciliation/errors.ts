import type { PermissionKey } from "@/lib/auth/permission-keys";

export class ReconciliationAuthorizationError extends Error {
  readonly status = 403;
  readonly code = "RECONCILIATION_UNAUTHORIZED";
  readonly requiredPermission?: PermissionKey;

  constructor(message: string, requiredPermission?: PermissionKey) {
    super(message);
    this.name = "ReconciliationAuthorizationError";
    this.requiredPermission = requiredPermission;
  }
}

export class ReconciliationConflictError extends Error {
  readonly status = 409;
  readonly code = "RECONCILIATION_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "ReconciliationConflictError";
  }
}
