import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:postgres@localhost:5433/kt_courier_phase265_integration?schema=public' } }
});

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "LedgerEntry", "LedgerJournal", "Payment", "PaymentAttempt", "PaymentWebhookEvent", "PaymentReconciliationCase", "PaymentRefund" CASCADE;');
  await prisma.$executeRawUnsafe('UPDATE "LedgerAccount" SET "currentBalance" = 0, "debitTotal" = 0, "creditTotal" = 0;');
  console.log('Reset integration DB ledger accounts and truncated payment tables!');
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
