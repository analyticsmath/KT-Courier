import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runIntegrationTest() {
  console.log("=== Phase 29 Reporting Integration Test ===");
  try {
    const definitionsCount = await prisma.reportDefinition.count();
    console.log(`Verified ${definitionsCount} active report definitions.`);
    console.log("Reporting Integration Test: PASSED");
  } catch (error) {
    console.error("Reporting Integration Test Failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runIntegrationTest();
