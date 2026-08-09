import { prisma } from "@/lib/db/prisma";
import {
  AdvertisingCampaignStatus,
  AdvertisingCampaignVersionStatus,
  AdvertisingClickChargeStatus,
  AdvertisingReconciliationStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

// Custom error for repository level issues
export class AdvertisingRepositoryError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "AdvertisingRepositoryError";
  }
}

// Helper to check operation replay and request hash mismatch
type AdvertisingPrisma = Pick<
  PrismaClient,
  | "advertisingAccount"
  | "advertisingPlacementDefinition"
  | "advertisingRateCardVersion"
  | "advertisingCampaign"
  | "advertisingCampaignVersion"
  | "advertisingCreativeSnapshot"
  | "advertisingTarget"
  | "advertisingFundingAllocation"
  | "advertisingFundingMovement"
  | "advertisingServeDecision"
  | "advertisingMeasurementEvent"
  | "advertisingClickCharge"
  | "advertisingAttribution"
  | "advertisingDailyAggregate"
  | "advertisingReconciliationCase"
>;

type OperationReplayRow = { operationId: string; requestHash: string };

async function verifyOperationReplay<T extends OperationReplayRow>(
  table: { findFirst(args: { where: { operationId: string } }): Promise<T | null> },
  operationId: string,
  requestHash: string
): Promise<T | null> {
  const existing = await table.findFirst({
    where: { operationId }
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AdvertisingRepositoryError(
        "IDEMPOTENCY_CONFLICT",
        `Conflict: Operation ${operationId} already processed with a different request hash.`
      );
    }
    return existing;
  }
  return null;
}

export function createPrismaAdvertisingAccountRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      const row = await db.advertisingAccount.findUnique({
        where: { publicReference }
      });
      if (!row) return null;
      // Safe projection: hide internal id, expose only publicReference, storeId, status, billingStatus, moderationStatus
      return {
        publicReference: row.publicReference,
        storeId: row.storeId,
        status: row.status,
        billingStatus: row.billingStatus,
        moderationStatus: row.moderationStatus,
        createdAt: row.createdAt
      };
    },
    async verifyStoreOwnership(publicReference: string, storeId: string) {
      const row = await db.advertisingAccount.findFirst({
        where: { publicReference, storeId }
      });
      return !!row;
    },
    async create(data: { storeId: string; publicReference: string }) {
      return db.advertisingAccount.create({
        data: {
          publicReference: data.publicReference,
          storeId: data.storeId,
          status: "ACTIVE",
          billingStatus: "ACTIVE",
          moderationStatus: "APPROVED"
        }
      });
    }
  });
}

export function createPrismaAdvertisingPlacementDefinitionRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingPlacementDefinition.findUnique({
        where: { publicReference }
      });
    },
    async findByCode(code: string) {
      return db.advertisingPlacementDefinition.findUnique({
        where: { code }
      });
    }
  });
}

export function createPrismaAdvertisingRateCardVersionRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingRateCardVersion.findUnique({
        where: { publicReference }
      });
    }
  });
}

export function createPrismaAdvertisingCampaignRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingCampaign.findUnique({
        where: { publicReference },
        include: { versions: { orderBy: { versionNumber: "desc" } } }
      });
    },
    async verifyStoreOwnership(publicReference: string, storeId: string) {
      const row = await db.advertisingCampaign.findFirst({
        where: { publicReference, storeId }
      });
      return !!row;
    },
    async create(data: { publicReference: string; advertisingAccountId: string; storeId: string; name: string }) {
      return db.advertisingCampaign.create({
        data: {
          publicReference: data.publicReference,
          advertisingAccountId: data.advertisingAccountId,
          storeId: data.storeId,
          name: data.name,
          status: "DRAFT"
        }
      });
    },
    async updateStatus(id: string, status: AdvertisingCampaignStatus) {
      return db.advertisingCampaign.update({
        where: { id },
        data: { status }
      });
    }
  });
}

export function createPrismaAdvertisingCampaignVersionRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingCampaignVersion.findUnique({
        where: { publicReference },
        include: { creativeSnapshots: true, campaign: true }
      });
    },
    async create(data: Prisma.AdvertisingCampaignVersionCreateInput) {
      return db.advertisingCampaignVersion.create({
        data
      });
    },
    async updateStatus(id: string, status: AdvertisingCampaignVersionStatus) {
      const current = await db.advertisingCampaignVersion.findUnique({ where: { id } });
      if (current && current.status === "RETIRED") {
        throw new AdvertisingRepositoryError("IMMUTABLE_VERSION", "Cannot update a retired campaign version.");
      }
      return db.advertisingCampaignVersion.update({
        where: { id },
        data: { status }
      });
    },
    async assertImmutable(id: string) {
      const version = await db.advertisingCampaignVersion.findUnique({ where: { id } });
      if (version && (version.approvedAt || version.status === "ACTIVE")) {
        throw new AdvertisingRepositoryError("IMMUTABLE_VERSION", "Approved/Active campaign versions are immutable.");
      }
    }
  });
}

export function createPrismaAdvertisingCreativeSnapshotRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingCreativeSnapshot.findUnique({
        where: { publicReference }
      });
    }
  });
}

export function createPrismaAdvertisingTargetRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findManyForVersion(campaignVersionId: string) {
      return db.advertisingTarget.findMany({
        where: { campaignVersionId }
      });
    }
  });
}

export function createPrismaAdvertisingFundingAllocationRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingFundingAllocation.findUnique({
        where: { publicReference }
      });
    },
    async checkReplay(operationId: string, requestHash: string) {
      return verifyOperationReplay(db.advertisingFundingAllocation, operationId, requestHash);
    },
    async create(data: Prisma.AdvertisingFundingAllocationCreateInput) {
      return db.advertisingFundingAllocation.create({
        data
      });
    },
    async updateRemainingAmount(id: string, amountChange: Prisma.Decimal, type: "SPEND" | "RETURN") {
      const current = await db.advertisingFundingAllocation.findUnique({ where: { id } });
      if (!current) throw new AdvertisingRepositoryError("ALLOCATION_NOT_FOUND", "Funding allocation not found.");
      
      let newRemaining: Prisma.Decimal;
      let newSpent = current.spentAmount;
      let newReturned = current.returnedAmount;
      
      if (type === "SPEND") {
        newRemaining = current.remainingAmount.sub(amountChange);
        newSpent = current.spentAmount.add(amountChange);
      } else {
        newRemaining = current.remainingAmount.sub(amountChange);
        newReturned = current.returnedAmount.add(amountChange);
      }

      if (newRemaining.lt(0)) {
        throw new AdvertisingRepositoryError("INSUFFICIENT_ALLOCATION_FUNDS", "Insufficient allocation funds.");
      }

      let status = current.status;
      if (newRemaining.isZero()) {
        status = type === "SPEND" ? "EXHAUSTED" : "RETURNED";
      } else {
        status = "PARTIALLY_SPENT";
      }

      return db.advertisingFundingAllocation.update({
        where: { id },
        data: {
          remainingAmount: newRemaining,
          spentAmount: newSpent,
          returnedAmount: newReturned,
          status,
          exhaustedAt: newRemaining.isZero() && type === "SPEND" ? new Date() : current.exhaustedAt,
          returnedAt: newRemaining.isZero() && type === "RETURN" ? new Date() : current.returnedAt
        }
      });
    }
  });
}

export function createPrismaAdvertisingFundingMovementRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingFundingMovement.findUnique({
        where: { publicReference }
      });
    },
    async checkReplay(operationId: string, requestHash: string) {
      return verifyOperationReplay(db.advertisingFundingMovement, operationId, requestHash);
    },
    async create(data: Prisma.AdvertisingFundingMovementCreateInput) {
      // Append-only constraint: only support creations
      return db.advertisingFundingMovement.create({
        data
      });
    }
  });
}

export function createPrismaAdvertisingServeDecisionRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingServeDecision.findUnique({
        where: { publicReference }
      });
    },
    async create(data: Prisma.AdvertisingServeDecisionCreateInput) {
      return db.advertisingServeDecision.create({
        data
      });
    }
  });
}

export function createPrismaAdvertisingMeasurementEventRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingMeasurementEvent.findUnique({
        where: { publicReference }
      });
    },
    async checkReplay(operationId: string, requestHash: string) {
      return verifyOperationReplay(db.advertisingMeasurementEvent, operationId, requestHash);
    },
    async create(data: Prisma.AdvertisingMeasurementEventCreateInput) {
      // Append-only: measurement events are append-only. Strip raw IP and raw UserAgent in database creation.
      const safeData = {
        ...data,
        sessionFingerprint: data.sessionFingerprint ? data.sessionFingerprint.substring(0, 8) + "..." : null, // Mask session fingerprint
        networkRiskFingerprint: null, // Exclude risk fingerprint
        userAgentClass: data.userAgentClass || "unknown"
      };
      return db.advertisingMeasurementEvent.create({
        data: safeData
      });
    }
  });
}

export function createPrismaAdvertisingClickChargeRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingClickCharge.findUnique({
        where: { publicReference }
      });
    },
    async checkReplay(operationId: string, requestHash: string) {
      return verifyOperationReplay(db.advertisingClickCharge, operationId, requestHash);
    },
    async create(data: Prisma.AdvertisingClickChargeCreateInput) {
      return db.advertisingClickCharge.create({
        data
      });
    },
    async updateStatus(id: string, status: AdvertisingClickChargeStatus, journalId?: string) {
      return db.advertisingClickCharge.update({
        where: { id },
        data: {
          status,
          reversedByJournalId: journalId,
          reversedAt: status === "REVERSED" ? new Date() : null
        }
      });
    }
  });
}

export function createPrismaAdvertisingAttributionRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingAttribution.findUnique({
        where: { publicReference }
      });
    },
    async create(data: Prisma.AdvertisingAttributionCreateInput) {
      return db.advertisingAttribution.create({
        data
      });
    }
  });
}

export function createPrismaAdvertisingDailyAggregateRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findUnique(campaignVersionId: string, placementDefinitionId: string, date: Date) {
      return db.advertisingDailyAggregate.findUnique({
        where: {
          campaignVersionId_placementDefinitionId_date: {
            campaignVersionId,
            placementDefinitionId,
            date
          }
        }
      });
    },
    async upsert(data: Prisma.AdvertisingDailyAggregateUpsertArgs) {
      return db.advertisingDailyAggregate.upsert(data);
    }
  });
}

export function createPrismaAdvertisingReconciliationCaseRepository(db: AdvertisingPrisma = prisma) {
  return Object.freeze({
    async findByPublicReference(publicReference: string) {
      return db.advertisingReconciliationCase.findUnique({
        where: { publicReference }
      });
    },
    async checkReplay(operationId: string, requestHash: string) {
      // Reconciliation cases have no operation-id/request-hash columns. They
      // cannot serve as an idempotency receipt without fabricating a query.
      void operationId;
      void requestHash;
      return null;
    },
    async create(data: Prisma.AdvertisingReconciliationCaseCreateInput) {
      return db.advertisingReconciliationCase.create({
        data
      });
    },
    async updateStatus(id: string, status: AdvertisingReconciliationStatus, resolutionCode?: string, summary?: string) {
      return db.advertisingReconciliationCase.update({
        where: { id },
        data: {
          status,
          resolutionCode,
          safeSummary: summary,
          resolvedAt: status === "RESOLVED" ? new Date() : null
        }
      });
    }
  });
}
