import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function retryFailedJobs() {
  console.log("=== Retrying Failed Report Jobs ===");
  try {
    const failedJobs = await prisma.reportJob.findMany({
      where: { status: "FAILED_RETRYABLE" },
      take: 10,
    });
    console.log(`Found ${failedJobs.length} retryable report jobs.`);
  } catch (error) {
    console.error("Error retrying report jobs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

retryFailedJobs();
