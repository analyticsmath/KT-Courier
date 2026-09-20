import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_STORES } from "./demo/fixtures/stores";
import { DEMO_CUSTOMERS } from "./demo/fixtures/customers";
import { DEMO_DRIVERS } from "./demo/fixtures/drivers";
import { DEMO_PROMOTERS } from "./demo/fixtures/promoters";

const prisma = new PrismaClient();

const FOUNDATION_EMAILS = [
  "superadmin@ktcouriers.local",
  "admin@ktcouriers.local",
  "customer@ktcouriers.local",
  "driver@ktcouriers.local",
  "store@ktcouriers.local",
  "promoter@ktcouriers.local",
] as const;

const CRITICAL_LOGIN_EMAILS = [
  "admin@ktcouriers.local",
  "store.ubuntu-fresh-market@ktcouriers.local",
  "driver.lerato.adams1@ktcouriers.local",
  "sizwe.zulu1@example.co.za",
  "tanya.chetty2@example.co.za",
] as const;

function requireProductionAuthorization(): string {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Demo credential sync requires NODE_ENV=production.");
  }
  if (process.env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() !== "production") {
    throw new Error("Demo credential sync requires KT_DATABASE_CLASSIFICATION=production.");
  }

  const password = process.env.KT_DEMO_ACCOUNT_PASSWORD?.trim() ?? "";
  if (password.length < 40) {
    throw new Error("KT_DEMO_ACCOUNT_PASSWORD must be at least 40 characters.");
  }
  return password;
}

function allSeededDemoEmails(): string[] {
  return Array.from(new Set([
    ...FOUNDATION_EMAILS,
    ...DEMO_STORES.map((store) => `store.${store.slug}@ktcouriers.local`),
    ...DEMO_CUSTOMERS.map((customer) => customer.email),
    ...DEMO_DRIVERS.map((driver) => driver.email),
    ...DEMO_PROMOTERS.map((promoter) => promoter.email),
  ]));
}

async function main(): Promise<void> {
  const password = requireProductionAuthorization();

  const critical = await prisma.user.findMany({
    where: { email: { in: [...CRITICAL_LOGIN_EMAILS] } },
    select: { email: true, role: true, status: true },
  });

  const found = new Set(critical.map((user) => user.email));
  const missing = CRITICAL_LOGIN_EMAILS.filter((email) => !found.has(email));
  if (missing.length > 0) {
    throw new Error(`Critical seeded demo accounts are missing: ${missing.join(", ")}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const seededEmails = allSeededDemoEmails();
  const updated = await prisma.user.updateMany({
    where: { email: { in: seededEmails } },
    data: { passwordHash },
  });

  console.log(JSON.stringify({
    event: "production_demo_credentials_synced",
    knownSeededEmails: seededEmails.length,
    updatedUsers: updated.count,
    criticalAccounts: critical.map((user) => ({
      email: user.email,
      role: user.role,
      status: user.status,
    })),
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Production demo credential sync failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
