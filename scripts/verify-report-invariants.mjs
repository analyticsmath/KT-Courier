import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyInvariants() {
  console.log("=== Verifying Phase 29 Reporting Database Invariants ===");
  try {
    const orphanedArtifacts = await prisma.reportExportArtifact.findMany({
      where: { jobId: { equals: "" } },
    });
    if (orphanedArtifacts.length > 0) {
      console.error(`INVARIANT FAILURE: ${orphanedArtifacts.length} orphaned artifacts found.`);
      process.exit(1);
    }

    console.log("Reporting Database Invariants: PASSED");
  } catch (error) {
    console.error("Invariant Verification Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyInvariants();
