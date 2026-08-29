/**
 * KT Couriers — Canonical Foundation Bootstrap Authority
 * Provides system-level roles, permissions, superadmin/admin accounts, delivery regions,
 * pricing rules, system settings, platform ledger accounts, and foundation ad placements.
 * Reusable by both prisma/seed.ts and scripts/seed-full-demo.ts.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

export const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("password123", 10);

export async function seedFoundationBootstrap(prisma: PrismaClient, options: {
  includeDevAuthAccounts?: boolean;
} = {}): Promise<{
  superAdminId: string;
  adminId: string;
  regions: Array<{ id: string; code: string; name: string }>;
}> {
  console.log("  [Bootstrap] Ensuring system permissions & roles...");

  // 1. Roles and standard user accounts
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@ktcouriers.local" },
    update: { name: "System Super Admin", role: "SUPER_ADMIN", status: "ACTIVE" },
    create: {
      email: "superadmin@ktcouriers.local",
      name: "System Super Admin",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ktcouriers.local" },
    update: { name: "Operations Admin", role: "ADMIN", status: "ACTIVE" },
    create: {
      email: "admin@ktcouriers.local",
      name: "Operations Admin",
      passwordHash: DEFAULT_PASSWORD_HASH,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  // 2. Delivery Regions (Gauteng operating area)
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

  // 3. Pricing Rules
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

  // 4. System Settings
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

  // 5. Platform Financial Wallet & Ledger Accounts
  console.log("  [Bootstrap] Ensuring platform financial ledger accounts...");
  const platformWallet = await prisma.wallet.upsert({
    where: { ownerType_ownerId_currency: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" } },
    update: {},
    create: {
      ownerType: "PLATFORM",
      ownerId: "platform",
      currency: "ZAR",
      status: "ACTIVE",
    },
  });

  const ledgerAccountDefs = [
    { code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET" },
    { code: "PLATFORM-ADJUSTMENT-ZAR", purpose: "ADJUSTMENT", category: "EQUITY" },
    { code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY" },
    { code: "PLATFORM-COMMISSION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE" },
    { code: "PLATFORM-PROMOTION-EXPENSE-ZAR", purpose: "SUSPENSE", category: "EXPENSE" },
  ];

  for (const la of ledgerAccountDefs) {
    await prisma.ledgerAccount.upsert({
      where: { walletId_purpose_currency: { walletId: platformWallet.id, purpose: la.purpose as any, currency: "ZAR" } },
      update: { code: la.code, status: "ACTIVE" },
      create: {
        walletId: platformWallet.id,
        code: la.code,
        purpose: la.purpose as any,
        category: la.category as any,
        currency: "ZAR",
        status: "ACTIVE",
      },
    });
  }

  // 6. Foundation Ad Placements
  const placements = [
    { type: "HOMEPAGE_BANNER", name: "Homepage Top Banner", basePrice: 250.0 },
    { type: "FEATURED_STORE", name: "Featured Merchant Highlight", basePrice: 180.0 },
    { type: "FEATURED_PRODUCT", name: "Featured Product Spotlight", basePrice: 120.0 },
    { type: "CATEGORY_PLACEMENT", name: "Category Header Banner", basePrice: 150.0 },
  ];

  for (const pl of placements) {
    await prisma.adPlacement.upsert({
      where: { type: pl.type as any },
      update: { name: pl.name, basePrice: new Prisma.Decimal(pl.basePrice), isActive: true },
      create: { type: pl.type as any, name: pl.name, basePrice: new Prisma.Decimal(pl.basePrice), isActive: true },
    });
  }

  // 7. If dev auth accounts requested (for simple test log in)
  if (options.includeDevAuthAccounts) {
    console.log("  [Bootstrap] Ensuring development testing auth logins...");
    await prisma.user.upsert({
      where: { email: "customer@ktcouriers.local" },
      update: { name: "Thabo Mokoena", role: "CUSTOMER", status: "ACTIVE" },
      create: { email: "customer@ktcouriers.local", name: "Thabo Mokoena", passwordHash: DEFAULT_PASSWORD_HASH, role: "CUSTOMER", status: "ACTIVE" },
    });

    await prisma.user.upsert({
      where: { email: "driver@ktcouriers.local" },
      update: { name: "Sipho Khumalo", role: "DRIVER", status: "ACTIVE" },
      create: { email: "driver@ktcouriers.local", name: "Sipho Khumalo", passwordHash: DEFAULT_PASSWORD_HASH, role: "DRIVER", status: "ACTIVE" },
    });

    await prisma.user.upsert({
      where: { email: "store@ktcouriers.local" },
      update: { name: "Nandi Khumalo", role: "STORE", status: "ACTIVE" },
      create: { email: "store@ktcouriers.local", name: "Nandi Khumalo", passwordHash: DEFAULT_PASSWORD_HASH, role: "STORE", status: "ACTIVE" },
    });

    await prisma.user.upsert({
      where: { email: "promoter@ktcouriers.local" },
      update: { name: "Lerato Sithole", role: "PROMOTER", status: "ACTIVE" },
      create: { email: "promoter@ktcouriers.local", name: "Lerato Sithole", passwordHash: DEFAULT_PASSWORD_HASH, role: "PROMOTER", status: "ACTIVE" },
    });
  }

  console.log("  [Bootstrap] Foundation bootstrap complete.");
  return { superAdminId: superAdmin.id, adminId: admin.id, regions };
}
