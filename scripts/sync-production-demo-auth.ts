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

const REQUESTED_LOGIN_EMAILS = [
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

async function ensureRequestedDemoIdentities(passwordHash: string): Promise<void> {
  const [driverFixture, customerOne, customerTwo, admin] = await Promise.all([
    Promise.resolve(DEMO_DRIVERS.find((driver) => driver.email === "driver.lerato.adams1@ktcouriers.local")),
    Promise.resolve(DEMO_CUSTOMERS.find((customer) => customer.email === "sizwe.zulu1@example.co.za")),
    Promise.resolve(DEMO_CUSTOMERS.find((customer) => customer.email === "tanya.chetty2@example.co.za")),
    prisma.user.findUnique({ where: { email: "admin@ktcouriers.local" }, select: { id: true } }),
  ]);

  if (!driverFixture || !customerOne || !customerTwo || !admin) {
    throw new Error("Required production demo identity fixture or admin authority is unavailable.");
  }

  const driverUser = await prisma.user.upsert({
    where: { email: driverFixture.email },
    update: {
      name: driverFixture.name,
      phone: driverFixture.phone,
      passwordHash,
      role: "DRIVER",
      status: "ACTIVE",
    },
    create: {
      email: driverFixture.email,
      name: driverFixture.name,
      phone: driverFixture.phone,
      passwordHash,
      role: "DRIVER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    update: {
      displayName: driverFixture.name,
      phone: driverFixture.phone,
      active: true,
      approvedAt: new Date(),
      approvedByAdminId: admin.id,
      availability: "OFFLINE",
      idNumber: driverFixture.idNumber,
      onboardingStatus: "APPROVED",
      status: "ACTIVE",
      vehicleMake: driverFixture.vehicleModel.split(" ")[0] ?? "Demo",
      vehicleModel: driverFixture.vehicleModel,
      vehicleRegistration: driverFixture.vehiclePlate,
      vehicleType: driverFixture.vehicleType === "MOTORCYCLE" ? "MOTORBIKE" : driverFixture.vehicleType,
    },
    create: {
      userId: driverUser.id,
      driverCode: "KT-DEMO-DRV-001",
      displayName: driverFixture.name,
      phone: driverFixture.phone,
      active: true,
      approvedAt: new Date(),
      approvedByAdminId: admin.id,
      availability: "OFFLINE",
      idNumber: driverFixture.idNumber,
      onboardingStatus: "APPROVED",
      status: "ACTIVE",
      vehicleMake: driverFixture.vehicleModel.split(" ")[0] ?? "Demo",
      vehicleModel: driverFixture.vehicleModel,
      vehicleRegistration: driverFixture.vehiclePlate,
      vehicleType: driverFixture.vehicleType === "MOTORCYCLE" ? "MOTORBIKE" : driverFixture.vehicleType,
    },
  });

  for (const customer of [customerOne, customerTwo]) {
    const user = await prisma.user.upsert({
      where: { email: customer.email },
      update: {
        name: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone,
        passwordHash,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
      create: {
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone,
        passwordHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.customerProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: `${customer.firstName} ${customer.lastName}`,
        defaultPhone: customer.phone,
      },
      create: {
        userId: user.id,
        displayName: `${customer.firstName} ${customer.lastName}`,
        defaultPhone: customer.phone,
      },
    });
  }
}

async function main(): Promise<void> {
  const password = requireProductionAuthorization();
  const passwordHash = await bcrypt.hash(password, 10);
  const seededEmails = allSeededDemoEmails();

  await ensureRequestedDemoIdentities(passwordHash);

  const updated = await prisma.user.updateMany({
    where: { email: { in: seededEmails } },
    data: { passwordHash },
  });

  const [requestedAccounts, activeSeededCandidates] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: [...REQUESTED_LOGIN_EMAILS] } },
      select: { email: true, role: true, status: true },
      orderBy: { email: "asc" },
    }),
    prisma.user.findMany({
      where: {
        email: { in: seededEmails },
        status: "ACTIVE",
        role: { in: ["ADMIN", "SUPER_ADMIN", "STORE", "DRIVER", "CUSTOMER"] },
      },
      select: { email: true, role: true, status: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
    }),
  ]);

  const found = new Set(requestedAccounts.map((user) => user.email));
  const missingRequested = REQUESTED_LOGIN_EMAILS.filter((email) => !found.has(email));
  if (missingRequested.length > 0) {
    throw new Error(`Requested production demo accounts are still missing: ${missingRequested.join(", ")}`);
  }

  console.log(JSON.stringify({
    event: "production_demo_credentials_synced",
    knownSeededEmails: seededEmails.length,
    updatedUsers: updated.count,
    requestedAccounts,
    missingRequested,
    activeSeededCandidates: activeSeededCandidates.slice(0, 40),
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
