export type RetentionActionType =
  | "DELETE"
  | "IRREVERSIBLY_MINIMIZE"
  | "REDACT_PAYLOAD"
  | "EXPIRE_ACCESS"
  | "DELETE_EXTERNAL_ARTIFACT"
  | "REVOKE_TOKEN"
  | "NO_AUTOMATED_DELETION";

export interface RetentionPolicyDefinition {
  readonly category: string;
  readonly description: string;
  readonly dataAuthority: string;
  readonly eligibilityField: string;
  readonly minimumRetentionDays: number;
  readonly actionType: RetentionActionType;
  readonly defaultBatchSize: number;
  readonly holdApplicable: boolean;
  readonly immutabilityClassification: "IMMUTABLE_FINANCIAL" | "OPERATIONAL_TEMPORARY" | "SENSITIVE_PII" | "AUDIT_LOG";
  readonly requiredPermission: string;
}

export const RETENTION_POLICY_REGISTRY: Record<string, RetentionPolicyDefinition> = {
  EXPIRED_SESSIONS: {
    category: "EXPIRED_SESSIONS",
    description: "Revoked or expired user web sessions past 30 days",
    dataAuthority: "Session",
    eligibilityField: "expiresAt",
    minimumRetentionDays: 30,
    actionType: "DELETE",
    defaultBatchSize: 500,
    holdApplicable: true,
    immutabilityClassification: "OPERATIONAL_TEMPORARY",
    requiredPermission: "settings.update",
  },
  EXPIRED_EMAIL_OTPS: {
    category: "EXPIRED_EMAIL_OTPS",
    description: "Consumed or expired email OTP codes past 24 hours",
    dataAuthority: "OtpCode",
    eligibilityField: "expiresAt",
    minimumRetentionDays: 1,
    actionType: "DELETE",
    defaultBatchSize: 500,
    holdApplicable: false,
    immutabilityClassification: "OPERATIONAL_TEMPORARY",
    requiredPermission: "settings.update",
  },
  EXPIRED_DELIVERY_OTPS: {
    category: "EXPIRED_DELIVERY_OTPS",
    description: "Expired delivery handoff verification OTPs past 7 days",
    dataAuthority: "DeliveryOtp",
    eligibilityField: "expiresAt",
    minimumRetentionDays: 7,
    actionType: "DELETE",
    defaultBatchSize: 200,
    holdApplicable: true,
    immutabilityClassification: "OPERATIONAL_TEMPORARY",
    requiredPermission: "settings.update",
  },
  EXPIRED_PASSWORD_RESET_TOKENS: {
    category: "EXPIRED_PASSWORD_RESET_TOKENS",
    description: "Used or expired password reset tokens past 24 hours",
    dataAuthority: "PasswordResetToken",
    eligibilityField: "expiresAt",
    minimumRetentionDays: 1,
    actionType: "DELETE",
    defaultBatchSize: 200,
    holdApplicable: false,
    immutabilityClassification: "OPERATIONAL_TEMPORARY",
    requiredPermission: "settings.update",
  },
  EXPIRED_REPORT_ARTIFACTS: {
    category: "EXPIRED_REPORT_ARTIFACTS",
    description: "Report export files in storage past artifact retention expiry",
    dataAuthority: "ReportArtifact",
    eligibilityField: "expiresAt",
    minimumRetentionDays: 1,
    actionType: "DELETE_EXTERNAL_ARTIFACT",
    defaultBatchSize: 50,
    holdApplicable: true,
    immutabilityClassification: "OPERATIONAL_TEMPORARY",
    requiredPermission: "settings.update",
  },
  PRECISE_DRIVER_LOCATIONS: {
    category: "PRECISE_DRIVER_LOCATIONS",
    description: "Raw driver GPS coordinates older than 90 days not tied to open dispute or POD evidence",
    dataAuthority: "DriverLocationEvidence",
    eligibilityField: "createdAt",
    minimumRetentionDays: 90,
    actionType: "IRREVERSIBLY_MINIMIZE",
    defaultBatchSize: 1000,
    holdApplicable: true,
    immutabilityClassification: "SENSITIVE_PII",
    requiredPermission: "settings.update",
  },
  NOTIFICATION_PROVIDER_PAYLOADS: {
    category: "NOTIFICATION_PROVIDER_PAYLOADS",
    description: "Old delivery payload details past 30 days",
    dataAuthority: "NotificationDelivery",
    eligibilityField: "createdAt",
    minimumRetentionDays: 30,
    actionType: "REDACT_PAYLOAD",
    defaultBatchSize: 500,
    holdApplicable: true,
    immutabilityClassification: "OPERATIONAL_TEMPORARY",
    requiredPermission: "settings.update",
  },
  SECURITY_NETWORK_METADATA: {
    category: "SECURITY_NETWORK_METADATA",
    description: "Security event network payloads older than 180 days",
    dataAuthority: "SecurityEvent",
    eligibilityField: "createdAt",
    minimumRetentionDays: 180,
    actionType: "REDACT_PAYLOAD",
    defaultBatchSize: 500,
    holdApplicable: true,
    immutabilityClassification: "AUDIT_LOG",
    requiredPermission: "settings.update",
  },
};
