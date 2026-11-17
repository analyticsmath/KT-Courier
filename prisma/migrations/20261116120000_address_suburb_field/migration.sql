-- Add canonical independent suburb column on Address so unit/building (line2) and suburb remain distinct.
ALTER TABLE "Address" ADD COLUMN "suburb" TEXT;
