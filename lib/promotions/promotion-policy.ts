import { PromotionCampaignLifecycleError } from "./promotion-errors";

export type CampaignStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "PAUSED" | "ENDED" | "RETIRED";
export type FundingType = "PLATFORM" | "STORE" | "SHARED";

export interface CampaignTransitionRequest {
  currentStatus: CampaignStatus;
  targetStatus: CampaignStatus;
}

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE", "DRAFT"],
  ACTIVE: ["PAUSED", "ENDED"],
  PAUSED: ["ACTIVE", "ENDED"],
  ENDED: ["RETIRED"],
  RETIRED: [],
};

export function validateCampaignTransition(request: CampaignTransitionRequest): void {
  const allowed = VALID_TRANSITIONS[request.currentStatus];
  if (!allowed.includes(request.targetStatus)) {
    throw new PromotionCampaignLifecycleError(
      "INVALID_TRANSITION",
      `Cannot transition campaign from ${request.currentStatus} to ${request.targetStatus}`
    );
  }
}

export function validateCampaignImmutability(status: CampaignStatus): void {
  if (["ACTIVE", "PAUSED", "ENDED", "RETIRED"].includes(status)) {
    throw new PromotionCampaignLifecycleError(
      "CAMPAIGN_IMMUTABLE",
      `Campaign cannot be modified in status ${status}`
    );
  }
}

export function validateFundingConfiguration(
  fundingType: FundingType,
  platformShareBps: number,
  storeOwnerId?: string
): void {
  if (fundingType === "SHARED") {
    if (platformShareBps < 0 || platformShareBps > 10000) {
      throw new PromotionCampaignLifecycleError(
        "INVALID_FUNDING_SHARE",
        "Platform share must be between 0 and 10000 bps for SHARED funding."
      );
    }
  }
  if (fundingType === "STORE" || fundingType === "SHARED") {
    if (!storeOwnerId) {
      throw new PromotionCampaignLifecycleError(
        "MISSING_STORE_OWNER",
        "STORE or SHARED campaigns require an ownerStoreId."
      );
    }
  }
}
