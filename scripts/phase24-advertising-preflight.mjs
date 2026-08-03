import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Phase 24 Advertising Preflight Scan ===");
  
  try {
    // 1. Verify DB connection
    await prisma.$connect();
    console.log("✔ Connected to PostgreSQL database successfully.");

    // 2. Check advertising account records
    const accountCount = await prisma.advertisingAccount.count();
    console.log(`✔ Found ${accountCount} advertising accounts.`);

    // 3. Check placement definitions
    const placements = await prisma.advertisingPlacementDefinition.findMany();
    console.log(`✔ Found ${placements.length} placement definitions.`);
    for (const pl of placements) {
      console.log(`   - [${pl.code}] Type: ${pl.sponsoredObjectType}, Surface: ${pl.surface}`);
    }

    // 4. Check rate cards
    const rateCards = await prisma.advertisingRateCardVersion.count();
    console.log(`✔ Found ${rateCards} rate card versions.`);

  } catch (error) {
    console.error("❌ Preflight scan failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
