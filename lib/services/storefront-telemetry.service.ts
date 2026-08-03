import { prisma } from "@/lib/db/prisma";

type TelemetryClient = { storefrontTelemetryEvent: { create(args: unknown): Promise<unknown> } };
const telemetryClient = prisma as unknown as TelemetryClient;

/** Best-effort anonymous operational telemetry. It is deliberately never read by ranking. */
export async function recordStorefrontTelemetry(input: {
  eventType: "SEARCH" | "ZERO_RESULTS" | "FILTER_APPLIED" | "RESULT_OPENED";
  normalizedQuery?: string;
  resultCount?: number;
  selectedFilterCodes?: string[];
  targetReference?: string;
  latencyMs?: number;
  searchIndexVersion?: string;
  serviceAreaReference?: string;
}): Promise<void> {
  const queryCategory = input.normalizedQuery ? `${Math.min(input.normalizedQuery.split(/\s+/).filter(Boolean).length, 8)}_TOKENS` : undefined;
  const filterCodes = [...new Set((input.selectedFilterCodes ?? []).filter((code) => /^[a-z][a-z0-9_]{0,39}$/.test(code)))].sort().slice(0, 8);
  const safeReference = input.targetReference && /^[A-Za-z0-9-]{3,160}$/.test(input.targetReference) ? input.targetReference : undefined;
  const safeArea = input.serviceAreaReference && /^[a-z0-9][a-z0-9-]{0,95}$/.test(input.serviceAreaReference) ? input.serviceAreaReference : undefined;
  try {
    await telemetryClient.storefrontTelemetryEvent.create({ data: { eventType: input.eventType, queryCategory, resultCount: Number.isSafeInteger(input.resultCount) && input.resultCount! >= 0 ? input.resultCount : null, selectedFilterCodes: filterCodes.length ? filterCodes : null, targetReference: safeReference ?? null, latencyMs: Number.isSafeInteger(input.latencyMs) && input.latencyMs! >= 0 ? input.latencyMs : null, searchIndexVersion: input.searchIndexVersion?.slice(0, 80) ?? null, serviceAreaReference: safeArea ?? null, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  } catch {
    // Telemetry failure must never make browsing/search unavailable.
  }
}

