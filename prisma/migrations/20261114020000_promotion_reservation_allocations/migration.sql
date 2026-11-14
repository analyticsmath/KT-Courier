-- Preserve reviewed source-line funding splits for settlement and refunds.
ALTER TABLE "PromotionReservation" ADD COLUMN "allocationEvidence" JSONB;
