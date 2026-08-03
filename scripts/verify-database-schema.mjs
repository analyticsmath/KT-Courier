import path from "node:path";
import process from "node:process";
import { loadLocalEnv, run, safeError, safeLog } from "./docker-common.mjs";

const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const env = loadLocalEnv();
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  safeError("DATABASE_URL is required for database-to-schema verification.");
  process.exit(1);
}

const result = run(
  process.execPath,
  [
    prismaCli,
    "migrate",
    "diff",
    "--from-url",
    databaseUrl,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--exit-code",
  ],
  { env }
);

if (result.status === 0) {
  safeLog("Database schema matches prisma/schema.prisma.");
  process.exit(0);
}

if (result.status === 2) {
  safeError("Database schema drift detected against prisma/schema.prisma.");
  if (result.stdout) safeError(result.stdout);
  process.exit(2);
}

safeError("Database-to-schema verification failed.");
if (result.stdout) safeError(result.stdout);
if (result.stderr) safeError(result.stderr);
process.exit(result.status ?? 1);
