-- Independent customer review of actual completing courier: not a merchandise or store rating.
CREATE TABLE "DriverReview" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverReview_rating_bounds" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "DriverReview_body_bounds" CHECK (char_length("body") BETWEEN 3 AND 2000)
);
CREATE UNIQUE INDEX "DriverReview_orderId_key" ON "DriverReview"("orderId");
CREATE INDEX "DriverReview_driverProfileId_createdAt_idx" ON "DriverReview"("driverProfileId","createdAt");
CREATE INDEX "DriverReview_authorUserId_createdAt_idx" ON "DriverReview"("authorUserId","createdAt");
ALTER TABLE "DriverReview" ADD CONSTRAINT "DriverReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverReview" ADD CONSTRAINT "DriverReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverReview" ADD CONSTRAINT "DriverReview_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
