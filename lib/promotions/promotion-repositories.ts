import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

// Helper for stable database lock ordering
export async function lockCampaignVersions(ids: string[], tx: Prisma.TransactionClient) {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort();
  await tx.$queryRaw`SELECT "id" FROM "PromotionCampaignVersion" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" ASC FOR UPDATE`;
}

export async function lockCodes(ids: string[], tx: Prisma.TransactionClient) {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort();
  await tx.$queryRaw`SELECT "id" FROM "PromotionCode" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" ASC FOR UPDATE`;
}

export async function lockBudgets(ids: string[], tx: Prisma.TransactionClient) {
  if (ids.length === 0) return;
  const sorted = [...new Set(ids)].sort();
  await tx.$queryRaw`SELECT "id" FROM "PromotionBudget" WHERE "id" IN (${Prisma.join(sorted)}) ORDER BY "id" ASC FOR UPDATE`;
}

export async function lockCustomer(userId: string, tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

export async function lockCheckout(checkoutId: string, tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`;
}

// Conflict and Replay helper
export async function checkIdempotence(
  tx: Prisma.TransactionClient,
  operationId: string,
  requestHash: string,
  operationType: string
) {
  void operationType;
  const existing = await tx.promotionOperation.findUnique({
    where: { operationId }
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new Error(`Conflict: Operation ${operationId} exists with different hash.`);
    }
    return existing;
  }
  return null;
}

export async function recordOperation(
  tx: Prisma.TransactionClient,
  operationId: string,
  requestHash: string,
  operationType: string,
  resultReference?: string
) {
  return tx.promotionOperation.create({
    data: {
      operationId,
      requestHash,
      operationType,
      resultReference,
    }
  });
}

// 1. PromotionCampaign
export const PromotionCampaignRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaign.findUnique({ where: { publicReference: ref } });
  },
  async create(data: Prisma.PromotionCampaignCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaign.create({ data });
  },
  async update(id: string, data: Prisma.PromotionCampaignUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaign.update({ where: { id }, data });
  }
};

// 2. PromotionCampaignVersion
export const PromotionCampaignVersionRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersion.findUnique({
      where: { publicReference: ref },
      include: { targets: true, eligibility: true, allowlist: true, budget: true }
    });
  },
  async findById(id: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersion.findUnique({
      where: { id },
      include: { targets: true, eligibility: true, allowlist: true, budget: true }
    });
  },
  async create(data: Prisma.PromotionCampaignVersionUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersion.create({ data });
  },
  async update(id: string, data: Prisma.PromotionCampaignVersionUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersion.update({ where: { id }, data });
  }
};

// 3. PromotionCampaignVersionTarget
export const PromotionCampaignVersionTargetRepo = {
  async createMany(data: Prisma.PromotionCampaignVersionTargetCreateManyInput[], tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersionTarget.createMany({ data });
  }
};

// 4. PromotionCampaignVersionEligibility
export const PromotionCampaignVersionEligibilityRepo = {
  async createMany(data: Prisma.PromotionCampaignVersionEligibilityCreateManyInput[], tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersionEligibility.createMany({ data });
  }
};

// 5. PromotionCampaignVersionCustomerAllowlist
export const PromotionCampaignVersionCustomerAllowlistRepo = {
  async createMany(data: Prisma.PromotionCampaignVersionCustomerAllowlistCreateManyInput[], tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCampaignVersionCustomerAllowlist.createMany({ data });
  }
};

// 6. PromotionCode
export const PromotionCodeRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    const code = await tx.promotionCode.findUnique({ where: { publicReference: ref } });
    if (!code) return null;
    return { ...code, codeHmac: "[MASKED]", codeFingerprint: "[MASKED]" }; // Safe DTO projection
  },
  async findByHmac(hmac: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCode.findUnique({ where: { codeHmac: hmac } });
  },
  async create(data: Prisma.PromotionCodeUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCode.create({ data });
  },
  async update(id: string, data: Prisma.PromotionCodeUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCode.update({ where: { id }, data });
  }
};

// 7. PromotionCodeBatch
export const PromotionCodeBatchRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCodeBatch.findUnique({ where: { publicReference: ref } });
  },
  async create(data: Prisma.PromotionCodeBatchUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCodeBatch.create({ data });
  },
  async update(id: string, data: Prisma.PromotionCodeBatchUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionCodeBatch.update({ where: { id }, data });
  }
};

// 8. PromotionBudget
export const PromotionBudgetRepo = {
  async findByCampaignVersionId(campaignVersionId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionBudget.findUnique({ where: { campaignVersionId } });
  },
  async create(data: Prisma.PromotionBudgetUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionBudget.create({ data });
  },
  // Optimistic version check
  async updateOptimistic(id: string, version: number, data: Omit<Prisma.PromotionBudgetUpdateInput, "version">, tx: Prisma.TransactionClient = prisma) {
    const result = await tx.promotionBudget.updateMany({
      where: { id, version },
      data: {
        ...data,
        version: version + 1
      }
    });
    if (result.count === 0) {
      throw new Error(`OptimisticLockError: Budget ${id} updated concurrently.`);
    }
  }
};

// 9. PromotionBudgetMovement
export const PromotionBudgetMovementRepo = {
  async create(data: Prisma.PromotionBudgetMovementUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionBudgetMovement.create({ data });
  }
};

// 10. PromotionReservation
export const PromotionReservationRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReservation.findUnique({ where: { publicReference: ref } });
  },
  async findByOperationId(operationId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReservation.findMany({ where: { operationId } });
  },
  async create(data: Prisma.PromotionReservationUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReservation.create({ data });
  },
  async update(id: string, data: Prisma.PromotionReservationUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReservation.update({ where: { id }, data });
  }
};

// 11. PromotionRedemption
export const PromotionRedemptionRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionRedemption.findUnique({ where: { publicReference: ref } });
  },
  async findByOperationId(operationId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionRedemption.findUnique({ where: { operationId } });
  },
  async create(data: Prisma.PromotionRedemptionUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionRedemption.create({ data });
  },
  async update(id: string, data: Prisma.PromotionRedemptionUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionRedemption.update({ where: { id }, data });
  }
};

// 12. PromotionFinancialAllocation
export const PromotionFinancialAllocationRepo = {
  async createMany(data: Prisma.PromotionFinancialAllocationCreateManyInput[], tx: Prisma.TransactionClient = prisma) {
    return tx.promotionFinancialAllocation.createMany({ data });
  }
};

// 13. PromotionReconciliationCase
export const PromotionReconciliationCaseRepo = {
  async findByPublicReference(ref: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReconciliationCase.findUnique({ where: { publicReference: ref } });
  },
  async create(data: Prisma.PromotionReconciliationCaseUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReconciliationCase.create({ data });
  },
  async update(id: string, data: Prisma.PromotionReconciliationCaseUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionReconciliationCase.update({ where: { id }, data });
  }
};

// 14. PromotionStatusHistory
export const PromotionStatusHistoryRepo = {
  async create(data: Prisma.PromotionStatusHistoryUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionStatusHistory.create({ data });
  }
};

// 15. PromotionEventIntent
export const PromotionEventIntentRepo = {
  async create(data: Prisma.PromotionEventIntentCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionEventIntent.create({ data });
  }
};

// 16. PromotionOperation
export const PromotionOperationRepo = {
  async findByOperationId(operationId: string, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionOperation.findUnique({ where: { operationId } });
  },
  async create(data: Prisma.PromotionOperationCreateInput, tx: Prisma.TransactionClient = prisma) {
    return tx.promotionOperation.create({ data });
  }
};
