import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runPreflight() {
  console.log("=== Phase 29 Reporting & Exports Preflight Audit ===");
  try {
    const definitionsCount = await prisma.reportDefinition.count();
    const jobsCount = await prisma.reportJob.count();
    const artifactsCount = await prisma.reportArtifact?.count() ?? await prisma.reportExportArtifact?.count() ?? 0;
    const casesCount = await prisma.reportReconciliationCase.count();

    console.log(`Report Definitions: ${definitionsCount}`);
    console.log(`Report Jobs: ${jobsCount}`);
    console.log(`Export Artifacts: ${artifactsCount}`);
    console.log(`Reconciliation Cases: ${casesCount}`);
    console.log("Preflight Status: OK");
  } catch (error) {
    console.error("Preflight Audit Failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPreflight();
