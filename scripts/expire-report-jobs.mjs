import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function expireOldJobs() {
  console.log("=== Expiring Old Report Jobs ===");
  try {
    const expired = await prisma.reportJob.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { not: "EXPIRED" },
      },
      data: { status: "EXPIRED" },
    });
    console.log(`Expired ${expired.count} report jobs.`);
  } catch (error) {
    console.error("Error expiring report jobs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

expireOldJobs();
