import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const ARTIFACT_STORAGE_DIR = process.env.REPORT_ARTIFACT_DIR || path.join(process.cwd(), "artifacts", "reports");

async function expireArtifacts() {
  console.log("=== Expiring Report Export Artifacts ===");
  try {
    const expiredArtifacts = await prisma.reportExportArtifact.findMany({
      where: { expiresAt: { lt: new Date() } },
    });

    let removedCount = 0;
    for (const art of expiredArtifacts) {
      const filePath = path.join(ARTIFACT_STORAGE_DIR, art.storageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    console.log(`Cleaned up ${removedCount} expired artifact files.`);
  } catch (error) {
    console.error("Error expiring report artifacts:", error);
  } finally {
    await prisma.$disconnect();
  }
}

expireArtifacts();
