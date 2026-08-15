import { spawnSync } from "node:child_process";
import process from "node:process";
import { PrismaClient } from "@prisma/client";

async function main() {
  console.log("[STRICT_BOLA_RUNNER] Verifying PostgreSQL readiness for BOLA authority matrix...");

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
  } catch (err) {
    console.error("[STRICT_BOLA_RUNNER] PostgreSQL is unavailable:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }

  console.log("[STRICT_BOLA_RUNNER] PostgreSQL is ready. Executing strict BOLA database authority matrix...");

  const testEnv = {
    ...process.env,
    STRICT_POSTGRES_REQUIRED: "1",
    KT_ALLOW_POSTGRES_INTEGRATION_TESTS: "1",
  };

  const testResult = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/security/bola-database-authority.integration.test.ts"],
    {
      env: testEnv,
      stdio: "inherit",
      encoding: "utf8",
    }
  );

  if (testResult.status !== 0) {
    console.error("[STRICT_BOLA_RUNNER] Strict BOLA integration matrix failed.");
    process.exit(testResult.status ?? 1);
  }

  console.log("[STRICT_BOLA_RUNNER] Strict PostgreSQL BOLA matrix PASSED.");
}

main().catch((err) => {
  console.error("[STRICT_BOLA_RUNNER] Unhandled error:", err);
  process.exit(1);
});
