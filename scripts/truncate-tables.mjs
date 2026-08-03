import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:postgres@localhost:5433/kt_courier_phase265_integration?schema=public' } }
});

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "LedgerEntry", "LedgerJournal", "Payment", "PaymentAttempt" CASCADE;');
  console.log('Truncated payment and ledger tables in integration DB');
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
