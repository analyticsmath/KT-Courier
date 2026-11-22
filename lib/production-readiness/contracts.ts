export type CapabilityStatus = "READY" | "BLOCKED_CONFIGURATION" | "BLOCKED_EXTERNAL_INPUT" | "BLOCKED_HUMAN_APPROVAL" | "BLOCKED_LIVE_ACCEPTANCE" | "DISABLED_BY_POLICY";
export type Capability = {
  key: string;
  status: CapabilityStatus;
  severity: "INFO" | "WARNING" | "BLOCKER";
  reasonCode: string;
  safeSummary: string;
  owner: "ENGINEERING" | "OPERATIONS" | "FINANCE" | "CLIENT" | "ADMIN_REVIEW";
  evidence?: Record<string, string | number | boolean | null | string[]>;
};

export const PRODUCTION_READINESS_CAPABILITY_ROUTES: Readonly<Record<string, { href: string; label: string }>> = {
  cod_policy: { href: "/admin/payment-policies", label: "Payment policies" },
  cod_remittance: { href: "/admin/cash-deposits", label: "Cash & banking" },
  operational_coverage: { href: "/admin/regions", label: "Delivery coverage" },
  courier_services: { href: "/admin/pricing", label: "Courier pricing" },
  notification_routes: { href: "/admin/notifications", label: "Notification settings" },
  notification_templates: { href: "/admin/notifications", label: "Notification settings" },
  payment_provider: { href: "/admin/payment-providers", label: "Provider diagnostics" },
};

export const PRODUCTION_READINESS_REPAIR_LINKS: readonly { label: string; href: string }[] = [
  { label: "Store repair cockpit", href: "/admin/stores" },
  { label: "Driver onboarding", href: "/admin/drivers" },
  { label: "Provider diagnostics", href: "/admin/payment-providers" },
  { label: "Coverage & regions", href: "/admin/regions" },
  { label: "Courier pricing", href: "/admin/pricing" },
];

export function capability(key: string, status: CapabilityStatus, reasonCode: string, safeSummary: string, owner: Capability["owner"], evidence?: Capability["evidence"]): Capability {
  return { key, status, reasonCode, safeSummary, owner, severity: status === "READY" ? "INFO" : status === "DISABLED_BY_POLICY" ? "WARNING" : "BLOCKER", ...(evidence ? { evidence } : {}) };
}

export function configurationCapability(key: string, configured: boolean, summary: string, owner: Capability["owner"] = "OPERATIONS"): Capability {
  return capability(key, configured ? "READY" : "BLOCKED_CONFIGURATION", configured ? "CONFIGURED" : "CONFIGURATION_MISSING", summary, owner);
}
