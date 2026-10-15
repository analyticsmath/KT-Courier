import { prisma } from "@/lib/db/prisma";
import { executeRegisteredProcessor } from "@/lib/processors/processor-service";

const limitIndex = process.argv.indexOf("--limit");
const batchSize = limitIndex < 0 ? 25 : Number(process.argv[limitIndex + 1]);
executeRegisteredProcessor({ name: "settle-marketplace-store-orders", mode: "APPLY", batchSize })
  .then(result => console.log(JSON.stringify(result)))
  .catch(() => { console.error("Marketplace settlement processor failed."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
