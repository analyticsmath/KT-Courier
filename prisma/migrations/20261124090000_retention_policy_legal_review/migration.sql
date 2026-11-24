ALTER TABLE "RetentionPolicyVersion"
  ADD COLUMN "legalReviewReference" TEXT,
  ADD COLUMN "legalReviewReason" TEXT,
  ADD COLUMN "legalReviewedByUserId" TEXT,
  ADD COLUMN "legalReviewedAt" TIMESTAMP(3);

CREATE INDEX "RetentionPolicyVersion_legalReviewedByUserId_idx"
  ON "RetentionPolicyVersion"("legalReviewedByUserId");

ALTER TABLE "RetentionPolicyVersion"
  ADD CONSTRAINT "RetentionPolicyVersion_legalReviewedByUserId_fkey"
  FOREIGN KEY ("legalReviewedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
