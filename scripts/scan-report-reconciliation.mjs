import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function scanReconciliation() {
  console.log("=== Scanning Reporting Reconciliation Cases ===");
  try {
    const cases = await prisma.reportReconciliationCase.findMany({
      where: { status: "OPEN" },
    });
    console.log(`Found ${cases.length} open reporting reconciliation cases.`);
  } catch (error) {
    console.error("Error scanning reporting reconciliation:", error);
  } finally {
    await prisma.$disconnect();
  }
}

scanReconciliation();
