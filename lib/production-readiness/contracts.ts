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

export function capability(key: string, status: CapabilityStatus, reasonCode: string, safeSummary: string, owner: Capability["owner"], evidence?: Capability["evidence"]): Capability {
  return { key, status, reasonCode, safeSummary, owner, severity: status === "READY" ? "INFO" : status === "DISABLED_BY_POLICY" ? "WARNING" : "BLOCKER", ...(evidence ? { evidence } : {}) };
}

export function configurationCapability(key: string, configured: boolean, summary: string, owner: Capability["owner"] = "OPERATIONS"): Capability {
  return capability(key, configured ? "READY" : "BLOCKED_CONFIGURATION", configured ? "CONFIGURED" : "CONFIGURATION_MISSING", summary, owner);
}
