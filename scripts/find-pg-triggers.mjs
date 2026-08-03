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
    WHERE routine_schema = 'public' AND routine_definition LIKE '%publicReference%';
  `);

  for (const f of funcs) {
    console.log(`Function ${f.routine_name}:`);
    const lines = f.routine_definition.split('\n');
    lines.forEach((l, idx) => {
      if (l.includes('publicReference')) {
        console.log(`  L${idx + 1}: ${l}`);
      }
    });
  }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
