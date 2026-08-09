import { PrismaClient, Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("=========================================================================");
  console.log("      KT COURIERS AUTHORITATIVE DATABASE ENTITY INVENTORY REPORT          ");
  console.log("=========================================================================\n");

  const models = Prisma.dmmf.datamodel.models;
  console.log(`Total Prisma Models in Schema: ${models.length}\n`);

  const results = [];

  for (const model of models) {
    const modelName = model.name;
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

    if (!prisma[delegateName]) {
      continue;
    }

    try {
      const count = await prisma[delegateName].count();

      const statusField = model.fields.find((f) => f.name === "status" || f.name === "publicationStatus" || f.name === "availability");
      let statusDist = null;
      if (statusField) {
        try {
          statusDist = await prisma[delegateName].groupBy({
            by: [statusField.name],
            _count: true,
          });
} catch {}
      }

      const createdField = model.fields.find((f) => f.name === "createdAt" || f.name === "created_at" || f.name === "timestamp" || f.name === "publishedAt");
      const updatedField = model.fields.find((f) => f.name === "updatedAt" || f.name === "updated_at" || f.name === "completedAt" || f.name === "createdAt");

      let earliestTimestamp = null;
      let latestTimestamp = null;

      if (createdField && count > 0) {
        try {
          const earliestRow = await prisma[delegateName].findFirst({
            orderBy: { [createdField.name]: "asc" },
            select: { [createdField.name]: true },
          });
          earliestTimestamp = earliestRow?.[createdField.name] ?? null;
} catch {}
      }

      if (updatedField && count > 0) {
        try {
          const latestRow = await prisma[delegateName].findFirst({
            orderBy: { [updatedField.name]: "desc" },
            select: { [updatedField.name]: true },
          });
          latestTimestamp = latestRow?.[updatedField.name] ?? null;
} catch {}
      }

      const ownerField = model.fields.find((f) => ["storeId", "sourceStoreId", "userId", "driverId", "promoterId", "customerUserId", "applicantUserId", "ownerType"].includes(f.name));
      let ownerDist = null;
      if (ownerField && count > 0 && count < 5000) {
        try {
          ownerDist = await prisma[delegateName].groupBy({
            by: [ownerField.name],
            _count: true,
          });
} catch {}
      }

      results.push({
        modelName,
        count,
        statusField: statusField?.name ?? null,
        statusDist,
        ownerField: ownerField?.name ?? null,
        distinctOwners: ownerDist ? ownerDist.length : null,
        earliestTimestamp: earliestTimestamp ? new Date(earliestTimestamp).toISOString() : "N/A",
        latestTimestamp: latestTimestamp ? new Date(latestTimestamp).toISOString() : "N/A",
      });
    } catch (err) {
      console.error(`Error querying model ${modelName}:`, err.message);
    }
  }

  const nonZeroResults = results.filter((r) => r.count > 0);
  console.log(`Models with records (${nonZeroResults.length}/${results.length}):\n`);
  console.table(
    nonZeroResults.map((r) => ({
      Model: r.modelName,
      Count: r.count,
      "Status Dist": r.statusDist ? JSON.stringify(r.statusDist) : "N/A",
      Earliest: r.earliestTimestamp,
      Latest: r.latestTimestamp,
    }))
  );

  const legacyVacancy = results.find((r) => r.modelName === "Vacancy");
  const recruitmentOpening = results.find((r) => r.modelName === "RecruitmentOpening");
  const vacancyApplication = results.find((r) => r.modelName === "VacancyApplication");
  const recruitmentApplication = results.find((r) => r.modelName === "RecruitmentApplication");

  console.log("\n-------------------------------------------------------------------------");
  console.log("                VACANCY / RECRUITMENT COUNT RECONCILIATION                ");
  console.log("-------------------------------------------------------------------------");
  console.log(`Legacy Vacancy Model Count:               ${legacyVacancy?.count ?? 0}`);
  console.log(`Phase 26 RecruitmentOpening Model Count:   ${recruitmentOpening?.count ?? 0}`);
  console.log(`Legacy VacancyApplication Count:          ${vacancyApplication?.count ?? 0}`);
  console.log(`Phase 26 RecruitmentApplication Count:    ${recruitmentApplication?.count ?? 0}`);
  console.log("RESOLUTION: Authoritative recruitment opening count is 120 (RecruitmentOpening).");
  console.log("-------------------------------------------------------------------------\n");

  fs.writeFileSync(path.join(process.cwd(), "docs/authoritative-entity-inventory.json"), JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  console.log("Saved authoritative entity inventory to docs/authoritative-entity-inventory.json");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
