-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN "idNumber" TEXT,
ADD COLUMN "idType" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "residentialAddress" TEXT,
ADD COLUMN "profilePhotoMediaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_profilePhotoMediaId_key" ON "DriverProfile"("profilePhotoMediaId");

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_profilePhotoMediaId_fkey" FOREIGN KEY ("profilePhotoMediaId") REFERENCES "PrivateMediaObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
