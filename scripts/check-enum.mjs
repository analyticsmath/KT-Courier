import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:postgres@localhost:5433/kt_courier_phase265_integration?schema=public' }
  }
});

async function main() {
  const enums = await prisma.$queryRawUnsafe(`
    SELECT typname, enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE typname LIKE '%Payment%' OR typname LIKE '%payment%';
  `);
  console.log('Payment-related enum values in DB:', JSON.stringify(enums, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
