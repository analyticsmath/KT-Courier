import { prisma } from "@/lib/db/prisma";
import { Prisma, AdvertisingMeasurementEventType, AdvertisingMeasurementValidity } from "@prisma/client";
import { assertAdvertisingProductionReady } from "./production-lock";

export type TrackEventInput = {
  campaignVersionId: string;
  placementDefinitionId: string;
  serveDecisionId: string;
  eventType: "SERVED_IMPRESSION" | "VIEWABLE_IMPRESSION" | "CLICK" | "CONVERSION";
  sessionFingerprint?: string;
  networkRiskFingerprint?: string;
  userAgentClass?: string;
  eventTimestamp?: Date;
  operationId: string;
  requestHash: string;
  safeEvidence?: Record<string, unknown>;
};

export class AdvertisingMeasurementService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  async trackEvent(input: TrackEventInput) {
    // Served and viewable measurement ingestion check
    assertAdvertisingProductionReady("MEASUREMENT_INGESTION");

    // Suppress duplicates for viewable impression and clicks
    if (input.eventType === "VIEWABLE_IMPRESSION" || input.eventType === "CLICK") {
      const existing = await this.db.advertisingMeasurementEvent.findFirst({
        where: {
          serveDecisionId: input.serveDecisionId,
          eventType: input.eventType as AdvertisingMeasurementEventType,
          validityStatus: AdvertisingMeasurementValidity.VALID
        }
      });
      if (existing) {
        // Return existing event instead of creating duplicate
        return existing;
      }
    }

    const publicRef = `AD-EV-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Clean sensitive user agent and IP data from evidence
    const cleanedEvidence = {
      ...(input.safeEvidence ?? {}),
      ip: undefined,
      userAgent: undefined
    };

    return this.db.advertisingMeasurementEvent.create({
      data: {
        publicReference: publicRef,
        campaignVersionId: input.campaignVersionId,
        placementDefinitionId: input.placementDefinitionId,
        serveDecisionId: input.serveDecisionId,
        eventType: input.eventType as AdvertisingMeasurementEventType,
        validityStatus: AdvertisingMeasurementValidity.VALID,
        sessionFingerprint: input.sessionFingerprint ?? null,
        networkRiskFingerprint: input.networkRiskFingerprint ?? null,
        userAgentClass: input.userAgentClass ?? null,
        eventTimestamp: input.eventTimestamp ?? new Date(),
        operationId: input.operationId,
        requestHash: input.requestHash,
        safeEvidence: cleanedEvidence
      }
    });
  }
}
