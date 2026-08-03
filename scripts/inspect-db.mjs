import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:postgres@localhost:5433/kt_courier_phase265_integration?schema=public' }
  }
});

async function main() {
  const fkeys = await prisma.$queryRawUnsafe(`
    SELECT
      tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='Payment';
  `);
  console.log('Foreign keys on Payment table:', JSON.stringify(fkeys, null, 2));

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Payment';
  `);
  console.log('Columns in Payment table:', JSON.stringify(cols, null, 2));
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
