export type RouteSecurityClass =
  | "PUBLIC_INTENTIONAL"
  | "AUTHENTICATED"
  | "ROLE_GATED"
  | "PERMISSION_GATED"
  | "OWNERSHIP_GATED"
  | "API_CLIENT_AUTHENTICATED"
  | "WEBHOOK_VERIFIED"
  | "INTERNAL_JOB";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface RouteSecurityPolicy {
  publicPathPattern: string;
  method: HttpMethod;
  securityClass: RouteSecurityClass;
  authenticationStrategy: "SESSION" | "BEARER_HMAC" | "SIGNATURE_VERIFIED" | "INTERNAL_SECRET" | "NONE";
  requiredRoles?: string[];
  requiredPermissions?: string[];
  ownershipStrategy?: "STORE_OWNER" | "CUSTOMER_OWNER" | "DRIVER_OWNER" | "DEVELOPER_OWNER" | "NONE";
  workflowRequirement?: string;
  rateLimitPolicy?: string;
  auditRequired: boolean;
  requestIntegrityRequired: boolean;
  sourceFile: string;
}

export interface RoutePolicyResolution {
  matchedPolicy: RouteSecurityPolicy | null;
  status: "MATCHED" | "UNCLASSIFIED" | "DUPLICATE_MATCH";
  candidateCount: number;
}
