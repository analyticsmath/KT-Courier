-- Claim remedy decisions delegate to the existing controlled Shipping
-- redelivery request. No delivery history or commercial balance is mutated.
ALTER TABLE "RedeliveryRequest" ADD COLUMN "sourceClaimId" TEXT;
ALTER TABLE "RedeliveryRequest" ADD COLUMN "remedyType" TEXT;
CREATE UNIQUE INDEX "RedeliveryRequest_sourceClaimId_key" ON "RedeliveryRequest"("sourceClaimId");
