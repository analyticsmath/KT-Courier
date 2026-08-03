import { PERMISSIONS } from "@/lib/auth/permission-keys";

export const REPORTING_PRODUCTION_VALIDATION_APPROVED = false as const;
export const REPORTING_PRODUCTION_LOCK_REASON = "REPORTING_CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export type ReportAudience =
  | "CUSTOMER"
  | "STORE"
  | "DRIVER"
  | "PROMOTER"
  | "RECRUITMENT"
  | "DEVELOPER"
  | "ADMINISTRATOR";

export type ReportJobStatus =
  | "REQUESTED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED_RETRYABLE"
  | "FAILED_PERMANENT"
  | "CANCELLED"
  | "EXPIRED";

export type ReportExecutionMode =
  | "SYNCHRONOUS_SUMMARY"
  | "ASYNCHRONOUS_REPORT"
  | "ASYNCHRONOUS_EXPORT";

export type ReportExportFormat = "CSV" | "JSON" | "XLSX";

export type ReportReconciliationReason =
  | "REPORT_JOB_WITHOUT_DEFINITION"
  | "REPORT_JOB_WITH_INVALID_FILTER_HASH"
  | "REPORT_JOB_STUCK_RUNNING"
  | "REPORT_JOB_WITHOUT_ARTIFACT"
  | "REPORT_ARTIFACT_WITHOUT_JOB"
  | "REPORT_ARTIFACT_CHECKSUM_MISMATCH"
  | "REPORT_ARTIFACT_EXPIRED_BUT_AVAILABLE"
  | "REPORT_PERMISSION_SNAPSHOT_MISMATCH"
  | "REPORT_OWNER_SCOPE_MISMATCH"
  | "REPORT_ROW_LIMIT_EXCEEDED"
  | "REPORT_STORAGE_FAILURE"
  | "REPORT_DOWNLOAD_AUDIT_MISSING"
  | "REPORT_DUPLICATE_EXECUTION";

export type ReportReconciliationStatus = "OPEN" | "IN_PROGRESS" | "CONVERGED";

export interface ReportFilterDefinition {
  key: string;
  label: string;
  type: "DATE_RANGE" | "STATUS" | "STRING" | "NUMBER" | "BOOLEAN";
  required?: boolean;
  allowedValues?: string[];
}

export interface ReportDefinitionContract {
  key: string;
  version: number;
  name: string;
  description: string;
  audience: ReportAudience;
  requiredPermission: string;
  resourceOwnerRule: "OWNER_ONLY" | "STORE_OWNER" | "DRIVER_OWNER" | "PROMOTER_OWNER" | "DEVELOPER_OWNER" | "ADMIN_PERMISSION";
  allowedFormats: ReportExportFormat[];
  allowedFilters: ReportFilterDefinition[];
  maximumDateRangeDays?: number;
  maximumRowCount: number;
  defaultOrdering?: { field: string; direction: "asc" | "desc" };
  sensitivity: "PUBLIC" | "LOW" | "MEDIUM" | "HIGH" | "RESTRICTED";
  retentionDays: number;
  piiPolicy: "ANONYMIZED" | "MINIMIZED" | "FULL_AUDITED";
  currencyPolicy: "ZAR_EXACT";
  timezonePolicy: "UTC";
}

export class ReportingError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReportingError";
  }
}

export const REPORT_DEFINITIONS: Record<string, ReportDefinitionContract> = {
  // Customer Reports
  "customer-courier-orders": {
    key: "customer-courier-orders",
    version: 1,
    name: "Customer Courier Orders Report",
    description: "Export courier delivery orders placed by the customer.",
    audience: "CUSTOMER",
    requiredPermission: PERMISSIONS.REPORT_READ_OWN,
    resourceOwnerRule: "OWNER_ONLY",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [{ key: "status", label: "Order Status", type: "STATUS" }],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "customer-payments": {
    key: "customer-payments",
    version: 1,
    name: "Customer Payment History Report",
    description: "Export customer payment receipts and status.",
    audience: "CUSTOMER",
    requiredPermission: PERMISSIONS.REPORT_READ_OWN,
    resourceOwnerRule: "OWNER_ONLY",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "customer-marketplace-orders": {
    key: "customer-marketplace-orders",
    version: 1,
    name: "Customer Marketplace Orders Report",
    description: "Export customer store purchase history.",
    audience: "CUSTOMER",
    requiredPermission: PERMISSIONS.REPORT_READ_OWN,
    resourceOwnerRule: "OWNER_ONLY",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "customer-personal-data": {
    key: "customer-personal-data",
    version: 1,
    name: "Customer Personal Data Privacy Export",
    description: "Approved personal data export file for privacy compliance.",
    audience: "CUSTOMER",
    requiredPermission: PERMISSIONS.REPORT_EXPORT_OWN,
    resourceOwnerRule: "OWNER_ONLY",
    allowedFormats: ["JSON"],
    allowedFilters: [],
    maximumRowCount: 1000,
    sensitivity: "HIGH",
    retentionDays: 7,
    piiPolicy: "FULL_AUDITED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },

  // Store Reports
  "store-orders": {
    key: "store-orders",
    version: 1,
    name: "Store Orders Operational Report",
    description: "Fulfilment and status breakdown for store orders.",
    audience: "STORE",
    requiredPermission: PERMISSIONS.STORE_REPORT_READ,
    resourceOwnerRule: "STORE_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [{ key: "status", label: "Store Order Status", type: "STATUS" }],
    maximumDateRangeDays: 365,
    maximumRowCount: 10000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "store-earnings": {
    key: "store-earnings",
    version: 1,
    name: "Store Earnings and Settlements Report",
    description: "Settled store revenue, commissions, and withdrawal history.",
    audience: "STORE",
    requiredPermission: PERMISSIONS.STORE_REPORT_READ,
    resourceOwnerRule: "STORE_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 10000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "HIGH",
    retentionDays: 60,
    piiPolicy: "ANONYMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "store-products-catalog": {
    key: "store-products-catalog",
    version: 1,
    name: "Store Product Catalog Export",
    description: "Export current store catalog items, variants, and stock status.",
    audience: "STORE",
    requiredPermission: PERMISSIONS.STORE_REPORT_READ,
    resourceOwnerRule: "STORE_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumRowCount: 10000,
    sensitivity: "LOW",
    retentionDays: 30,
    piiPolicy: "ANONYMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },

  // Driver Reports
  "driver-completed-deliveries": {
    key: "driver-completed-deliveries",
    version: 1,
    name: "Driver Completed Deliveries Report",
    description: "Delivery history and assignment log for authenticated driver.",
    audience: "DRIVER",
    requiredPermission: PERMISSIONS.DRIVER_REPORT_READ_OWN,
    resourceOwnerRule: "DRIVER_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "completedAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "driver-earnings": {
    key: "driver-earnings",
    version: 1,
    name: "Driver Earnings and Adjustments Report",
    description: "Delivery pay, adjustments, and payout history for driver.",
    audience: "DRIVER",
    requiredPermission: PERMISSIONS.DRIVER_REPORT_READ_OWN,
    resourceOwnerRule: "DRIVER_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "HIGH",
    retentionDays: 60,
    piiPolicy: "ANONYMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },

  // Promoter Reports
  "promoter-referrals": {
    key: "promoter-referrals",
    version: 1,
    name: "Promoter Referrals and Performance Report",
    description: "Privacy-safe referral attribution and qualification log.",
    audience: "PROMOTER",
    requiredPermission: PERMISSIONS.PROMOTER_REPORT_READ_OWN,
    resourceOwnerRule: "PROMOTER_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "ANONYMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "promoter-earnings": {
    key: "promoter-earnings",
    version: 1,
    name: "Promoter Earnings and Holds Report",
    description: "Held, released, and paid promoter commission earnings.",
    audience: "PROMOTER",
    requiredPermission: PERMISSIONS.PROMOTER_REPORT_READ_OWN,
    resourceOwnerRule: "PROMOTER_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "HIGH",
    retentionDays: 60,
    piiPolicy: "ANONYMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },

  // Developer Reports
  "developer-api-usage": {
    key: "developer-api-usage",
    version: 1,
    name: "Developer API Usage & Quota Audit Report",
    description: "API request volume and quota consumption log.",
    audience: "DEVELOPER",
    requiredPermission: PERMISSIONS.DEVELOPER_REPORT_READ_OWN,
    resourceOwnerRule: "DEVELOPER_OWNER",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "MEDIUM",
    retentionDays: 30,
    piiPolicy: "ANONYMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },

  // Admin Reports
  "admin-order-volume": {
    key: "admin-order-volume",
    version: 1,
    name: "Admin System Order Volume & Performance",
    description: "Comprehensive courier order volume, dispatch times, and status counts.",
    audience: "ADMINISTRATOR",
    requiredPermission: PERMISSIONS.REPORT_JOB_READ,
    resourceOwnerRule: "ADMIN_PERMISSION",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [{ key: "status", label: "Status", type: "STATUS" }],
    maximumDateRangeDays: 365,
    maximumRowCount: 10000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "HIGH",
    retentionDays: 90,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "admin-payfast-reconciliation": {
    key: "admin-payfast-reconciliation",
    version: 1,
    name: "Admin PayFast ITN & Payment Reconciliation Audit",
    description: "Provider-neutral payment verification and ITN reconciliation ledger report.",
    audience: "ADMINISTRATOR",
    requiredPermission: PERMISSIONS.REPORT_JOB_READ,
    resourceOwnerRule: "ADMIN_PERMISSION",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 10000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "HIGH",
    retentionDays: 90,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "admin-financial-reconciliation": {
    key: "admin-financial-reconciliation",
    version: 1,
    name: "Admin Complete Financial Ledger & Balances Audit",
    description: "System double-entry ledger balance summary, commissions, and withdrawals.",
    audience: "ADMINISTRATOR",
    requiredPermission: PERMISSIONS.REPORT_RESTRICTED_DATA_READ,
    resourceOwnerRule: "ADMIN_PERMISSION",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumDateRangeDays: 365,
    maximumRowCount: 10000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "RESTRICTED",
    retentionDays: 180,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
  "admin-recruitment-pipeline": {
    key: "admin-recruitment-pipeline",
    version: 1,
    name: "Admin Workforce Recruitment Pipeline Summary",
    description: "Stage distribution, application volumes, and time-to-hire (Strictly minimized).",
    audience: "ADMINISTRATOR",
    requiredPermission: PERMISSIONS.REPORT_RESTRICTED_DATA_READ,
    resourceOwnerRule: "ADMIN_PERMISSION",
    allowedFormats: ["CSV", "JSON"],
    allowedFilters: [],
    maximumRowCount: 5000,
    defaultOrdering: { field: "createdAt", direction: "desc" },
    sensitivity: "RESTRICTED",
    retentionDays: 30,
    piiPolicy: "MINIMIZED",
    currencyPolicy: "ZAR_EXACT",
    timezonePolicy: "UTC",
  },
};
