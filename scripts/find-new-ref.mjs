import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres:postgres@localhost:5433/kt_courier_phase265_integration?schema=public' }
  }
});

async function main() {
  const funcs = await prisma.$queryRawUnsafe(`
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_name = 'protect_payment_identity_and_success';
  `);
  console.log(funcs[0].routine_definition);
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
