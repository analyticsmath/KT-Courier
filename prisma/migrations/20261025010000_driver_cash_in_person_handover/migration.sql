-- Add a separately auditable physical-handover route without changing older bank deposits.
ALTER TABLE "DriverCashDeposit" ADD COLUMN "remittanceMethod" TEXT NOT NULL DEFAULT 'BANK_DEPOSIT';
ALTER TABLE "DriverCashDeposit" ADD CONSTRAINT "DriverCashDeposit_remittanceMethod_check" CHECK ("remittanceMethod" IN ('BANK_DEPOSIT', 'IN_PERSON'));
