/**
 * KT Couriers — Canonical Foundation Bootstrap Seed
 *
 * Initializes canonical system permissions, superadmin/admin accounts,
 * delivery regions, pricing rules, system settings, platform ledger accounts,
 * and foundation ad placements.
 *
 * Strictly uses idempotent upserts. Never logs raw passwords.
 * Does NOT contain low-quality legacy fixtures (Demo Customer, KT-DEV orders).
 */

import { PrismaClient, Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertSeedExecutionAllowed } from "../lib/security/seed-safety";
import { DEFAULT_ADMIN_PERMISSION_KEYS, SYSTEM_PERMISSION_DEFINITIONS } from "../lib/auth/permission-keys";
import {
  FOUNDATION_AD_PLACEMENTS,
  FOUNDATION_PLATFORM_WALLET,
  FOUNDATION_PLATFORM_LEDGER_ACCOUNTS,
} from "../lib/constants/foundation-models";

const prisma = new PrismaClient();
export const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("password123", 10);

export async function seedFoundationBootstrap(prisma: PrismaClient, options: {
  includeDevAuthAccounts?: boolean;
} = {}): Promise<{
  superAdminId: string;
  adminId: string;
  regions: Array<{ id: string; code: string; name: string }>;
}> {
  console.log("  [Bootstrap] Ensuring system permissions & roles...");

  // 1. Permissions & Role Permissions
  for (const def of SYSTEM_PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { name: def.name, description: def.description, category: def.category },
      create: { key: def.key, name: def.name, description: def.description, category: def.category },
    });
  }

  for (const permKey of DEFAULT_ADMIN_PERMISSION_KEYS) {
    const perm = await prisma.permission.findUnique({ where: { key: permKey } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: "ADMIN", permissionId: perm.id } },
        update: {},
        create: { role: "ADMIN", permissionId: perm.id },
      });
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: "SUPER_ADMIN", permissionId: perm.id } },
        update: {},
        create: { role: "SUPER_ADMIN", permissionId: perm.id },
      });
    }
  }

  // 2. Roles and standard administrator accounts
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@ktcouriers.local" },
    update: { name: "System Super Admin", role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    create: {
      email: "superadmin@ktcouriers.local",
      name: "System Super Admin",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ktcouriers.local" },
    update: { name: "Operations Admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    create: {
      email: "admin@ktcouriers.local",
      name: "Operations Admin",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // 3. Delivery Regions (Gauteng operating area focused)
  console.log("  [Bootstrap] Ensuring delivery operating regions...");
  const regionDefs = [
    { slug: "johannesburg-metro", name: "Johannesburg Metro", city: "Johannesburg", province: "Gauteng", baseFee: 45.0, active: true },
    { slug: "pretoria-metro", name: "Pretoria Metro", city: "Pretoria", province: "Gauteng", baseFee: 45.0, active: true },
    { slug: "sandton-rosebank", name: "Sandton and Rosebank Central", city: "Johannesburg", province: "Gauteng", baseFee: 40.0, active: true },
    { slug: "midrand-centurion", name: "Midrand and Centurion Corridor", city: "Midrand", province: "Gauteng", baseFee: 42.0, active: true },
    { slug: "braamfontein-cbd", name: "Braamfontein and Inner City", city: "Johannesburg", province: "Gauteng", baseFee: 35.0, active: true },
    { slug: "fourways-north", name: "Fourways and Northern Suburbs", city: "Johannesburg", province: "Gauteng", baseFee: 45.0, active: true },
    { slug: "cape-town-metro", name: "Cape Town Metro", city: "Cape Town", province: "Western Cape", baseFee: 50.0, active: true },
    { slug: "durban-metro", name: "Durban Metro", city: "Durban", province: "KwaZulu-Natal", baseFee: 50.0, active: true },
  ];

  const regions: Array<{ id: string; code: string; name: string }> = [];
  for (const r of regionDefs) {
    const region = await prisma.deliveryRegion.upsert({
      where: { slug: r.slug },
      update: { name: r.name, baseFee: new Prisma.Decimal(r.baseFee), active: r.active },
      create: {
        slug: r.slug,
        name: r.name,
        city: r.city,
        province: r.province,
        baseFee: new Prisma.Decimal(r.baseFee),
        active: r.active,
      },
    });
    regions.push({ id: region.id, code: region.slug, name: region.name });
  }

  // 4. Baseline Pricing Rules
  console.log("  [Bootstrap] Ensuring baseline pricing rules...");
  const existingRules = await prisma.pricingRule.count();
  if (existingRules === 0) {
    await prisma.pricingRule.create({
      data: {
        name: "Standard Same-Day Parcel",
        type: "FLAT",
        deliveryType: "SAME_DAY",
        amount: new Prisma.Decimal(45.0),
        baseFee: new Prisma.Decimal(45.0),
        perKmRate: new Prisma.Decimal(7.5),
        minimumCharge: new Prisma.Decimal(45.0),
        active: true,
      },
    });
    await prisma.pricingRule.create({
      data: {
        name: "Scheduled Delivery Dispatch",
        type: "FLAT",
        deliveryType: "SCHEDULED",
        amount: new Prisma.Decimal(38.0),
        baseFee: new Prisma.Decimal(38.0),
        perKmRate: new Prisma.Decimal(6.0),
        minimumCharge: new Prisma.Decimal(38.0),
        active: true,
      },
    });
  }

  // 5. System Settings
  console.log("  [Bootstrap] Ensuring platform settings...");
  const settings = [
    { key: "platform.name", label: "Platform Name", type: "STRING", value: "KT Couriers" },
    { key: "platform.contact_email", label: "Contact Email", type: "STRING", value: "support@ktcouriers.co.za" },
    { key: "platform.contact_phone", label: "Contact Phone", type: "STRING", value: "+27 11 403 1000" },
    { key: "platform.country", label: "Country Code", type: "STRING", value: "ZA" },
    { key: "platform.currency", label: "Platform Currency", type: "STRING", value: "ZAR" },
    { key: "pricing.vat.enabled", label: "VAT Enabled", type: "BOOLEAN", value: true },
    { key: "pricing.vat.rate", label: "VAT Rate", type: "NUMBER", value: 0.15 },
    { key: "dispatch.max_radius_km", label: "Max Dispatch Radius", type: "NUMBER", value: 35 },
    { key: "dispatch.auto_assign_timeout_seconds", label: "Auto Assign Timeout", type: "NUMBER", value: 45 },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { label: s.label, type: s.type as any, value: s.value },
      create: { key: s.key, label: s.label, type: s.type as any, value: s.value },
    });
  }

  // 6. Platform Financial Wallet & Ledger Accounts
  console.log("  [Bootstrap] Ensuring platform financial ledger accounts...");
  const platformWallet = await prisma.wallet.upsert({
    where: {
      ownerType_ownerId_currency: {
        ownerType: FOUNDATION_PLATFORM_WALLET.ownerType as any,
        ownerId: FOUNDATION_PLATFORM_WALLET.ownerId,
        currency: FOUNDATION_PLATFORM_WALLET.currency,
      },
    },
    update: {},
    create: {
      ownerType: FOUNDATION_PLATFORM_WALLET.ownerType as any,
      ownerId: FOUNDATION_PLATFORM_WALLET.ownerId,
      currency: FOUNDATION_PLATFORM_WALLET.currency,
      status: "ACTIVE",
    },
  });

  for (const la of FOUNDATION_PLATFORM_LEDGER_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { walletId_purpose_currency: { walletId: platformWallet.id, purpose: la.purpose as any, currency: la.currency } },
      update: { code: la.code, status: "ACTIVE" },
      create: {
        walletId: platformWallet.id,
        code: la.code,
        purpose: la.purpose as any,
        category: la.category as any,
        currency: la.currency,
        status: "ACTIVE",
      },
    });
  }

  // 7. Foundation Ad Placements
  for (const pl of FOUNDATION_AD_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { type: pl.type as any },
      update: { name: pl.name, basePrice: new Prisma.Decimal(pl.basePrice), isActive: true },
      create: { type: pl.type as any, name: pl.name, basePrice: new Prisma.Decimal(pl.basePrice), isActive: true },
    });
  }

  // 8. Development testing auth logins
  if (options.includeDevAuthAccounts) {
    console.log("  [Bootstrap] Ensuring development testing auth logins...");
    await prisma.user.upsert({
      where: { email: "customer@ktcouriers.local" },
      update: { name: "Thabo Mokoena", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
      create: { email: "customer@ktcouriers.local", name: "Thabo Mokoena", passwordHash: DEFAULT_PASSWORD_HASH, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE },
    });

    await prisma.user.upsert({
      where: { email: "driver@ktcouriers.local" },
      update: { name: "Sipho Khumalo", role: UserRole.DRIVER, status: UserStatus.ACTIVE },
      create: { email: "driver@ktcouriers.local", name: "Sipho Khumalo", passwordHash: DEFAULT_PASSWORD_HASH, role: UserRole.DRIVER, status: UserStatus.ACTIVE },
    });

    await prisma.user.upsert({
      where: { email: "store@ktcouriers.local" },
      update: { name: "Nandi Khumalo", role: UserRole.STORE, status: UserStatus.ACTIVE },
      create: { email: "store@ktcouriers.local", name: "Nandi Khumalo", passwordHash: DEFAULT_PASSWORD_HASH, role: UserRole.STORE, status: UserStatus.ACTIVE },
    });

    await prisma.user.upsert({
      where: { email: "promoter@ktcouriers.local" },
      update: { name: "Lerato Sithole", role: UserRole.PROMOTER, status: UserStatus.ACTIVE },
      create: { email: "promoter@ktcouriers.local", name: "Lerato Sithole", passwordHash: DEFAULT_PASSWORD_HASH, role: UserRole.PROMOTER, status: UserStatus.ACTIVE },
    });
  }

  console.log("  [Bootstrap] Foundation bootstrap complete.");
  return { superAdminId: superAdmin.id, adminId: admin.id, regions };
}

async function main() {
  assertSeedExecutionAllowed();

  console.log("🌱  Starting KT Couriers canonical foundation seed...");
  await seedFoundationBootstrap(prisma, { includeDevAuthAccounts: true });
  console.log("\n✅  Canonical foundation seed complete.");
}

if (process.argv[1]?.includes("seed.ts")) {
  main()
    .catch((err) => {
      console.error("❌  Seed failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
