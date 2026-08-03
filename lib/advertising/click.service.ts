import { prisma } from "@/lib/db/prisma";
import { Prisma, AdvertisingMeasurementValidity, AdvertisingMeasurementEventType, AdvertisingClickChargeStatus, AdvertisingReconciliationReason } from "@prisma/client";
import { ServeTokenPayload } from "./serving.service";
import { AdvertisingMeasurementService } from "./measurement.service";
import { AdvertisingBillingService, AdvertisingBillingError } from "./billing.service";

export type ClickClassification =
  | "VALID_BILLABLE"
  | "VALID_NON_BILLABLE"
  | "SUSPECT_REVIEW"
  | "INVALID";

export class AdvertisingClickService {
  constructor(private readonly tx?: Prisma.TransactionClient) {}

  private get db() {
    return this.tx || prisma;
  }

  async processClick(
    payload: ServeTokenPayload,
    sessionFingerprint: string,
    userAgentClass?: string
  ): Promise<{ destination: string }> {
    // 1. Resolve immutable serve decision
    const serveDecision = await this.db.advertisingServeDecision.findUnique({
      where: { publicReference: payload.serveDecisionId },
      include: {
        campaignVersion: {
          include: {
            creativeSnapshots: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        }
      }
    });

    if (!serveDecision) {
      throw new Error("Serve decision not found.");
    }

    const creative = serveDecision.campaignVersion.creativeSnapshots[0];
    const destination = creative?.destinationReference || "/";

    // Validate internal destination only
    if (!destination.startsWith("/") || destination.includes("://")) {
      throw new Error("Unauthorized destination redirect.");
    }

    // 2. Classify immediate validity
    const classificationResult = await this.classifyClick(payload, sessionFingerprint, userAgentClass);

    // 3. Record click measurement
    const measurementService = new AdvertisingMeasurementService(this.tx);
    const measurementEvent = await measurementService.trackEvent({
      campaignVersionId: payload.campaignVersionId,
      placementDefinitionId: payload.placementCode,
      serveDecisionId: payload.serveDecisionId,
      eventType: "CLICK",
      sessionFingerprint,
      userAgentClass,
      operationId: `OP-ME-${payload.serveDecisionId}-${Date.now()}`,
      requestHash: `HASH-ME-${payload.serveDecisionId}-${Date.now()}`
    });

    // Update the validity status based on classification
    await this.db.advertisingMeasurementEvent.update({
      where: { id: measurementEvent.id },
      data: {
        validityStatus: classificationResult.validity
      }
    });

    // 4. Invoke canonical click application service (billing)
    if (classificationResult.classification === "VALID_BILLABLE") {
      const billingService = new AdvertisingBillingService(this.tx);
      try {
        await billingService.chargeValidAdvertisingClick({
          measurementEventId: measurementEvent.id,
          sessionFingerprint,
          operationId: `OP-CHG-${measurementEvent.id}`,
          requestHash: `HASH-CHG-${measurementEvent.id}`
        });
      } catch (billingError: any) {
        // Billing failure opens reconciliation case
        const publicRef = `AD-REC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        await this.db.advertisingReconciliationCase.create({
          data: {
            publicReference: publicRef,
            campaignVersionId: payload.campaignVersionId,
            measurementEventId: measurementEvent.id,
            reason: AdvertisingReconciliationReason.VALID_CLICK_WITHOUT_CHARGE,
            status: "OPEN",
            priority: "HIGH",
            safeSummary: `Valid click was recorded but charging failed: ${billingError.message || "Unknown error"}`,
            safeEvidence: { error: billingError.message || "Unknown error" }
          }
        });
      }
    }

    return { destination };
  }

  async classifyClick(
    payload: ServeTokenPayload,
    sessionFingerprint: string,
    userAgentClass?: string
  ): Promise<{ validity: AdvertisingMeasurementValidity; classification: ClickClassification; reason?: string }> {
    // 1. Bot check
    if (userAgentClass === "bot" || userAgentClass === "crawler") {
      return { validity: "INVALID", classification: "INVALID", reason: "BOT_OR_CRAWLER" };
    }

    // 2. Impossible click velocity check
    const oneSecondAgo = new Date(Date.now() - 1000);
    const recentClick = await this.db.advertisingMeasurementEvent.findFirst({
      where: {
        sessionFingerprint,
        eventType: "CLICK",
        eventTimestamp: { gte: oneSecondAgo }
      }
    });
    if (recentClick) {
      return { validity: "INVALID", classification: "INVALID", reason: "VELOCITY_VIOLATION" };
    }

    // 3. Deduplication check
    const existingClick = await this.db.advertisingMeasurementEvent.findFirst({
      where: {
        serveDecisionId: payload.serveDecisionId,
        eventType: "CLICK",
        validityStatus: "VALID"
      }
    });
    if (existingClick) {
      return { validity: "VALID", classification: "VALID_NON_BILLABLE", reason: "DUPLICATE_CLICK" };
    }

    // Check if campaign is active and funded at serve time
    const version = await this.db.advertisingCampaignVersion.findUnique({
      where: { id: payload.campaignVersionId },
      include: {
        fundingAllocations: {
          where: { status: { in: ["FUNDED", "PARTIALLY_SPENT"] } }
        }
      }
    });
    if (!version || version.status !== "ACTIVE") {
      return { validity: "INVALID", classification: "INVALID", reason: "CAMPAIGN_INACTIVE" };
    }

    const remainingFunds = version.fundingAllocations.reduce((sum, alloc) => sum.add(alloc.remainingAmount), new Prisma.Decimal(0));
    if (remainingFunds.lte(0)) {
      return { validity: "VALID", classification: "VALID_NON_BILLABLE", reason: "EXHAUSTED_FUNDING" };
    }

    return { validity: "VALID", classification: "VALID_BILLABLE" };
  }
}
