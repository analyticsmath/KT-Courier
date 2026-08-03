import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function processQueuedJobs() {
  console.log("=== Processing Queued Report Jobs ===");
  try {
    const queuedJobs = await prisma.reportJob.findMany({
      where: { status: "QUEUED" },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${queuedJobs.length} queued report jobs.`);
  } catch (error) {
    console.error("Error processing queued report jobs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

processQueuedJobs();
