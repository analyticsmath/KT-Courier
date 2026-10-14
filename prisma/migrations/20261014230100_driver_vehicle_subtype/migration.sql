-- Non-destructive, nullable, and compatible with all existing fleet records.
-- Preserve legacy dispatch class while recording the document-specified vehicle body style.
ALTER TABLE "Vehicle" ADD COLUMN "vehicleSubtype" VARCHAR(32);
