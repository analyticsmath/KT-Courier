/**
 * KT Couriers — Comprehensive Full Demo Dataset Seed Script
 *
 * DEVELOPMENT ONLY — populates kt_courier_demo_full with ~1 year (July 2025 - July 2026)
 * of realistic, interconnected operational demo data.
 *
 * Commands:
 *   npm run demo:seed
 *   tsx scripts/seed-full-demo.ts
 */

import {
  PrismaClient,
  Prisma,
  UserRole,
  UserStatus,
  StoreStatus,
  DriverStatus,
  DriverAvailability,
  DriverOnboardingStatus,
  VehicleType,
  OrderStatus,
  DeliveryType,
  OrderSource,
  AddressType,
  SystemSettingType,
  ReportAudience,
  ReportJobStatus,
  ReportExecutionMode,
  ReportExportFormat,
  RecordStatus,
  PromoterAccountStatus,
  PaymentSubjectType,
  PaymentPurpose,
  PaymentStatus,
  PaymentProvider,
  LedgerCurrency,
  VacancyStatus,
  RecruitmentApplicationStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { syncSystemPermissions } from "../lib/auth/permissions";
import {
  DEFAULT_ADMIN_PERMISSION_KEYS,
  DEFAULT_STORE_CATALOG_PERMISSION_KEYS,
  SYSTEM_PERMISSION_DEFINITIONS,
} from "../lib/auth/permission-keys";
import {
  FOUNDATION_AD_PLACEMENTS,
  FOUNDATION_PLATFORM_LEDGER_ACCOUNTS,
  FOUNDATION_PLATFORM_WALLET,
} from "../lib/constants/foundation-models";
import { catalogPublicReference } from "../lib/catalog/catalog-normalization";
import { buildCatalogPublicationSnapshot } from "../lib/catalog/catalog-publication-snapshot";
import { StorefrontProjectionService } from "../lib/services/storefront-projection.service";
import { rebuildStorefrontStoreDocument } from "../lib/services/storefront-store.service";
import { rebuildStorefrontCategoryDocument } from "../lib/services/storefront-category.service";
import { toInputJsonObject } from "../lib/json/input-json";

const prisma = new PrismaClient();
const projectionService = new StorefrontProjectionService();

const DEMO_PASSWORD = process.env.KT_DEMO_ACCOUNT_PASSWORD || "KT-Demo-2026!";
const SALT_ROUNDS = 10;
const SEED_RUN_ID = `SEED-${Date.now()}`;
const RANDOM_SEED = 123456789;

// Fixed PRNG for deterministic data creation
function createSeededRandom(seed: number) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = createSeededRandom(RANDOM_SEED);

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + rand() * (end.getTime() - start.getTime()));
}

function computeFileSHA256(filePath: string): { checksum: string; byteSize: number } {
  const fullPath = join(process.cwd(), "public", filePath.replace(/^\//, ""));
  if (existsSync(fullPath)) {
    const buffer = readFileSync(fullPath);
    return {
      checksum: createHash("sha256").update(buffer).digest("hex"),
      byteSize: buffer.byteLength,
    };
  }
  const hash = createHash("sha256").update(filePath).digest("hex");
  return { checksum: hash, byteSize: 85000 };
}

// Historical Period: 1 July 2025 – 30 July 2026
const HISTORICAL_START = new Date("2025-07-01T00:00:00Z");
const HISTORICAL_END = new Date("2026-07-30T23:59:59Z");

async function seedPaymentWithEvidence(params: {
  publicReference: string;
  userId: string;
  orderId?: string;
  marketplaceCheckoutId?: string;
  subjectType: PaymentSubjectType;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  amount: number;
  creationIdempotencyKey: string;
  orderNumber: string;
  createdAt: Date;
}) {
  const amountDec = new Prisma.Decimal(params.amount);
  const pHash = createHash("sha256").update(params.orderNumber).digest("hex");

  const existingPayment = await prisma.payment.findUnique({
    where: { publicReference: params.publicReference },
  });

  if (existingPayment && existingPayment.status === PaymentStatus.SUCCEEDED) {
    return existingPayment;
  }

  const payment = await prisma.payment.upsert({
    where: { publicReference: params.publicReference },
    update: {},
    create: {
      publicReference: params.publicReference,
      userId: params.userId,
      orderId: params.orderId,
      marketplaceCheckoutId: params.marketplaceCheckoutId,
      subjectType: params.subjectType,
      purpose: params.purpose,
      provider: params.status === PaymentStatus.SUCCEEDED ? PaymentProvider.PAYFAST : null,
      status: params.status === PaymentStatus.SUCCEEDED ? PaymentStatus.PROCESSING : params.status,
      amount: amountDec,
      currency: LedgerCurrency.ZAR,
      creationIdempotencyKey: params.creationIdempotencyKey,
      creationRequestHash: pHash,
      failedAt: params.status === PaymentStatus.FAILED ? params.createdAt : null,
      createdAt: params.createdAt,
    },
  });

  if (params.status === PaymentStatus.SUCCEEDED) {
    const mRef = `mref_seed_${payment.id}`.slice(0, 100);
    const patRef = `pat_seed_${payment.id}`.slice(0, 100);
    const pweRef = `pwe_seed_${payment.id}`.slice(0, 100);

    const attempt = await prisma.paymentAttempt.upsert({
      where: { publicReference: patRef },
      update: { status: "SUCCEEDED" },
      create: {
        publicReference: patRef,
        paymentId: payment.id,
        merchantReference: mRef,
        provider: PaymentProvider.PAYFAST,
        providerEnvironment: "SANDBOX",
        amount: amountDec,
        currency: LedgerCurrency.ZAR,
        attemptNumber: 1,
        idempotencyKey: `idem_att_${payment.id}`,
        requestHash: pHash,
        status: "SUCCEEDED",
        createdAt: params.createdAt,
      },
    });

    const journal = await prisma.ledgerJournal.upsert({
      where: { idempotencyKey: `idem_jnl_${payment.id}` },
      update: {},
      create: {
        reference: `jnl_pay_${payment.id}`,
        type: "EXTERNAL_PAYMENT_RECEIPT",
        currency: LedgerCurrency.ZAR,
        idempotencyKey: `idem_jnl_${payment.id}`,
        correlationId: payment.publicReference,
        requestHash: pHash,
        policyVersion: "v1",
        totalDebits: amountDec,
        totalCredits: amountDec,
        postedAt: params.createdAt,
        createdAt: params.createdAt,
      },
    });

    const fingerprint = createHash("sha256").update(`fp_${payment.id}`).digest("hex");
    const webhook = await prisma.paymentWebhookEvent.upsert({
      where: { publicReference: pweRef },
      update: {},
      create: {
        publicReference: pweRef,
        provider: PaymentProvider.PAYFAST,
        environment: "SANDBOX",
        eventFingerprint: fingerprint,
        merchantReference: mRef,
        providerPaymentId: `pf_seed_${payment.id}`,
        providerStatus: "COMPLETE",
        normalizedStatus: "COMPLETE",
        processingStatus: "APPLIED",
        paymentId: payment.id,
        attemptId: attempt.id,
        ledgerJournalId: journal.id,
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: true,
        amountVerified: true,
        providerDataVerified: true,
        verifiedAt: params.createdAt,
        appliedAt: params.createdAt,
        createdAt: params.createdAt,
      },
    });

    return await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        succeededAt: params.createdAt,
        providerConfirmedAt: params.createdAt,
        successfulAttemptId: attempt.id,
        successWebhookEventId: webhook.id,
        successLedgerJournalId: journal.id,
        latestAttemptNumber: 1,
        version: { increment: 1 },
      },
    });
  }

  return payment;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || "";
  const isLocalDb =
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("db:5432") ||
    dbUrl.includes("db:5433");

  if (process.env.NODE_ENV === "production" || !isLocalDb) {
    throw new Error("❌ ERROR: Refusing to seed non-local or production database!");
  }

  const startTime = Date.now();
  console.log(`🌱 Starting KT Couriers Full Demonstration Dataset Seed [Run ID: ${SEED_RUN_ID}]...`);
  console.log(`   Period: ${HISTORICAL_START.toISOString().slice(0, 10)} to ${HISTORICAL_END.toISOString().slice(0, 10)}`);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. SYSTEM SETTINGS & PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣  Seeding System Permissions & Core Settings...");

  const permissionIdsByKey = new Map<string, string>();
  for (const definition of SYSTEM_PERMISSION_DEFINITIONS) {
    const permission = await prisma.permission.upsert({
      where: { key: definition.key },
      update: { name: definition.name, category: definition.category, description: definition.description, isSystem: true },
      create: { key: definition.key, name: definition.name, category: definition.category, description: definition.description, isSystem: true },
    });
    permissionIdsByKey.set(definition.key, permission.id);
  }

  for (const key of DEFAULT_ADMIN_PERMISSION_KEYS) {
    const pId = permissionIdsByKey.get(key);
    if (pId) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: UserRole.ADMIN, permissionId: pId } },
        update: { enabled: true },
        create: { role: UserRole.ADMIN, permissionId: pId, enabled: true },
      });
    }
  }

  for (const key of DEFAULT_STORE_CATALOG_PERMISSION_KEYS) {
    const pId = permissionIdsByKey.get(key);
    if (pId) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: UserRole.STORE, permissionId: pId } },
        update: { enabled: true },
        create: { role: UserRole.STORE, permissionId: pId, enabled: true },
      });
    }
  }

  const settings = [
    { key: "platform.name", label: "Platform Name", type: SystemSettingType.STRING, value: "KT Couriers", description: "Public display name." },
    { key: "platform.contact_email", label: "Contact Email", type: SystemSettingType.STRING, value: "info@demo.ktcouriers.test", description: "Primary contact email." },
    { key: "platform.operating_hours", label: "Operating Hours", type: SystemSettingType.STRING, value: "Mon–Fri 08:00–18:00, Sat 09:00–14:00", description: "Operating hours." },
    { key: "orders.require_confirmation", label: "Require Confirmation", type: SystemSettingType.BOOLEAN, value: true, description: "Order confirmation policy." },
    { key: "orders.default_currency", label: "Default Currency", type: SystemSettingType.STRING, value: "ZAR", description: "Currency." },
    { key: "pricing.vat.enabled", label: "VAT Enabled", type: SystemSettingType.BOOLEAN, value: false, description: "VAT policy." },
    { key: "pricing.vat.rate", label: "VAT Rate", type: SystemSettingType.STRING, value: "0.1500", description: "VAT rate." },
    { key: "pricing.quote_ttl_minutes", label: "Quote TTL", type: SystemSettingType.STRING, value: "15", description: "Quote TTL." },
    { key: "dispatch.assignment_offer_ttl_minutes", label: "Dispatch TTL", type: SystemSettingType.STRING, value: "10", description: "Dispatch TTL." },
    { key: "dispatch.policy_version", label: "Dispatch Policy Version", type: SystemSettingType.STRING, value: "dispatch-v1", description: "Dispatch version." },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  for (const placement of FOUNDATION_AD_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { type: placement.type },
      update: { name: placement.name, description: placement.description, basePrice: placement.basePrice, currency: placement.currency, isActive: true },
      create: { type: placement.type, name: placement.name, description: placement.description, basePrice: placement.basePrice, currency: placement.currency, isActive: true },
    });
  }

  const platformWallet = await prisma.wallet.upsert({
    where: { ownerType_ownerId_currency: { ownerType: FOUNDATION_PLATFORM_WALLET.ownerType, ownerId: FOUNDATION_PLATFORM_WALLET.ownerId, currency: FOUNDATION_PLATFORM_WALLET.currency } },
    update: { status: "ACTIVE" },
    create: { ownerType: FOUNDATION_PLATFORM_WALLET.ownerType, ownerId: FOUNDATION_PLATFORM_WALLET.ownerId, currency: FOUNDATION_PLATFORM_WALLET.currency, status: "ACTIVE" },
  });

  for (const def of FOUNDATION_PLATFORM_LEDGER_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: def.code },
      update: {},
      create: { walletId: platformWallet.id, code: def.code, purpose: def.purpose, category: def.category, currency: def.currency, allowNegative: def.allowNegative },
    });
  }

  for (const ownerType of ["STORE", "DRIVER", "PROMOTER"] as const) {
    await prisma.withdrawalPolicy.upsert({
      where: { ownerType_currency: { ownerType, currency: "ZAR" } },
      update: { enabled: true, requiresReview: true, requiresDualControl: true },
      create: { ownerType, currency: "ZAR", enabled: true, requiresReview: true, requiresDualControl: true },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. SOUTH AFRICAN DELIVERY REGIONS & PRICING RULES
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n2️⃣  Seeding South African Service Coverage Regions & Pricing Rules...");

  const saRegions = [
    { name: "Johannesburg Metro", slug: "johannesburg-metro", city: "Johannesburg", province: "Gauteng", centerLat: -26.2041, centerLng: 28.0473, coverageRadiusKm: 35, displayOrder: 1 },
    { name: "Pretoria & Tshwane", slug: "pretoria-tshwane", city: "Pretoria", province: "Gauteng", centerLat: -25.7479, centerLng: 28.2293, coverageRadiusKm: 30, displayOrder: 2 },
    { name: "Cape Town Metro", slug: "cape-town-metro", city: "Cape Town", province: "Western Cape", centerLat: -33.9249, centerLng: 18.4241, coverageRadiusKm: 30, displayOrder: 3 },
    { name: "Durban Metro", slug: "durban-metro", city: "Durban", province: "KwaZulu-Natal", centerLat: -29.8587, centerLng: 31.0218, coverageRadiusKm: 25, displayOrder: 4 },
    { name: "Gqeberha (Port Elizabeth)", slug: "gqeberha-pe", city: "Gqeberha", province: "Eastern Cape", centerLat: -33.9608, centerLng: 25.6022, coverageRadiusKm: 20, displayOrder: 5 },
    { name: "Bloemfontein Central", slug: "bloemfontein-central", city: "Bloemfontein", province: "Free State", centerLat: -29.1181, centerLng: 26.2243, coverageRadiusKm: 18, displayOrder: 6 },
    { name: "Mbombela (Nelspruit)", slug: "mbombela-nelspruit", city: "Mbombela", province: "Mpumalanga", centerLat: -25.4753, centerLng: 30.9694, coverageRadiusKm: 15, displayOrder: 7 },
    { name: "Polokwane Metro", slug: "polokwane-metro", city: "Polokwane", province: "Limpopo", centerLat: -23.9045, centerLng: 29.4689, coverageRadiusKm: 15, displayOrder: 8 },
  ];

  const regionMap = new Map<string, string>();
  for (const r of saRegions) {
    const reg = await prisma.deliveryRegion.upsert({
      where: { slug: r.slug },
      update: { name: r.name, active: true },
      create: { ...r, active: true, description: `Official KT Couriers operational coverage zone for ${r.name}.` },
    });
    regionMap.set(r.slug, reg.id);
  }

  const pricingRules = [
    { name: "Base Same-Day Delivery", type: "FLAT" as const, deliveryType: DeliveryType.SAME_DAY, amount: 75.0, baseFee: 75.0, currency: "ZAR" },
    { name: "Scheduled Delivery Service", type: "FLAT" as const, deliveryType: DeliveryType.SCHEDULED, amount: 60.0, baseFee: 60.0, currency: "ZAR" },
    { name: "Business Account Delivery", type: "FLAT" as const, deliveryType: DeliveryType.BUSINESS, amount: 55.0, baseFee: 55.0, currency: "ZAR" },
    { name: "Parcel & Document Delivery", type: "PARCEL_SIZE" as const, deliveryType: DeliveryType.PARCEL_DOCUMENT, amount: 50.0, baseFee: 50.0, currency: "ZAR" },
  ];

  for (const rule of pricingRules) {
    const existing = await prisma.pricingRule.findFirst({ where: { name: rule.name } });
    if (!existing) await prisma.pricingRule.create({ data: rule });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. FEATURED INTERACTIVE LOGIN ACCOUNTS & STAFF ROLES
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n3️⃣  Seeding Platform & Administrative Staff Accounts...");

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@demo.ktcouriers.test" },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: { email: "superadmin@demo.ktcouriers.test", passwordHash, name: "KT Super Admin", role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, adminProfile: { create: { displayName: "KT Super Admin", jobTitle: "Chief Executive Administrator", department: "Executive" } } },
  });

  await syncSystemPermissions({ actorUserId: superAdmin.id });

  // 3 Operations Admins
  const opsAdmins = [
    { email: "ops.admin.01@demo.ktcouriers.test", name: "Kagiso Molefe", title: "Head of Operations" },
    { email: "ops.admin.02@demo.ktcouriers.test", name: "Zanele Khumalo", title: "Regional Dispatch Coordinator" },
    { email: "ops.admin.03@demo.ktcouriers.test", name: "Pieter Van Zyl", title: "Logistics Manager" },
  ];
  for (const a of opsAdmins) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: { email: a.email, passwordHash, name: a.name, role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, adminProfile: { create: { displayName: a.name, jobTitle: a.title, department: "Operations" } } },
    });
  }

  // 3 Finance Admins
  const finAdmins = [
    { email: "finance.admin.01@demo.ktcouriers.test", name: "Sipho Dlamini", title: "Chief Financial Officer" },
    { email: "finance.admin.02@demo.ktcouriers.test", name: "Annelize Botha", title: "Senior Finance Controller" },
    { email: "finance.admin.03@demo.ktcouriers.test", name: "Lindiwe Ndlovu", title: "Settlement & Payout Lead" },
  ];
  for (const a of finAdmins) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: { email: a.email, passwordHash, name: a.name, role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, adminProfile: { create: { displayName: a.name, jobTitle: a.title, department: "Finance" } } },
    });
  }

  // 3 Support Staff
  const supportStaff = [
    { email: "support.agent.01@demo.ktcouriers.test", name: "Tebogo Mabena", title: "Customer Support Specialist" },
    { email: "support.agent.02@demo.ktcouriers.test", name: "Chantal Pillay", title: "Merchant Care Agent" },
    { email: "support.agent.03@demo.ktcouriers.test", name: "Ndivhuwo Mudau", title: "Escalation Desk Officer" },
  ];
  for (const a of supportStaff) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: { email: a.email, passwordHash, name: a.name, role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, adminProfile: { create: { displayName: a.name, jobTitle: a.title, department: "Support" } } },
    });
  }

  // 3 Recruitment Officers
  const recruitmentStaff = [
    { email: "recruiter.01@demo.ktcouriers.test", name: "Nomvula Bhengu", title: "Talent Acquisition Lead" },
    { email: "recruiter.02@demo.ktcouriers.test", name: "David Swanepoel", title: "Recruitment Specialist" },
    { email: "hiring.manager.01@demo.ktcouriers.test", name: "Thandiwe Sithole", title: "Hiring Manager" },
  ];
  for (const a of recruitmentStaff) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: { email: a.email, passwordHash, name: a.name, role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, adminProfile: { create: { displayName: a.name, jobTitle: a.title, department: "Human Resources" } } },
    });
  }

  // 2 Dev Platform Admins & 2 Catalog Moderators
  const otherAdmins = [
    { email: "dev.admin.01@demo.ktcouriers.test", name: "Farai Moyo", title: "Developer Platform Lead", dept: "Engineering" },
    { email: "dev.admin.02@demo.ktcouriers.test", name: "Lara Venter", title: "API Operations Specialist", dept: "Engineering" },
    { email: "catalog.mod.01@demo.ktcouriers.test", name: "Bongani Nene", title: "Marketplace Quality Lead", dept: "Catalog" },
    { email: "catalog.mod.02@demo.ktcouriers.test", name: "Susan Coetzee", title: "Merchandise Reviewer", dept: "Catalog" },
  ];
  for (const a of otherAdmins) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: { email: a.email, passwordHash, name: a.name, role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, adminProfile: { create: { displayName: a.name, jobTitle: a.title, department: a.dept } } },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. CUSTOMERS (~500 Customer Accounts)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n4️⃣  Seeding 500 Customer Accounts & Profiles...");

  const customer1 = await prisma.user.upsert({
    where: { email: "customer.01@demo.ktcouriers.test" },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: { email: "customer.01@demo.ktcouriers.test", passwordHash, name: "Lerato Mokoena", phone: "+27 82 555 0101", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, customerProfile: { create: { displayName: "Lerato Mokoena", defaultPhone: "+27 82 555 0101" } } },
  });

  const customer2 = await prisma.user.upsert({
    where: { email: "customer.02@demo.ktcouriers.test" },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: { email: "customer.02@demo.ktcouriers.test", passwordHash, name: "Johan Pretorius", phone: "+27 83 555 0102", role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START, customerProfile: { create: { displayName: "Johan Pretorius", defaultPhone: "+27 83 555 0102" } } },
  });

  const customerIds: string[] = [customer1.id, customer2.id];
  const saFirstNames = ["Aphiwe", "Sibusiso", "Buhle", "Willem", "Janine", "Kabelo", "Lethabo", "Nthabiseng", "Mpho", "Tshepo", "Ruan", "Anika", "Zolani", "Xolani", "Yandisa", "Vuyo"];
  const saLastNames = ["Naidoo", "Govender", "Smith", "Marais", "Nkosi", "Zulu", "Mthembu", "Baloyi", "Chauke", "Venter", "Fourie", "Mahlangu", "Kekana", "Modise"];

  for (let i = 3; i <= 500; i++) {
    const fn = randomElement(saFirstNames);
    const ln = randomElement(saLastNames);
    const email = `customer.${String(i).padStart(3, "0")}@demo.ktcouriers.test`;
    const status = i > 490 ? UserStatus.SUSPENDED : (i > 485 ? UserStatus.DISABLED : UserStatus.ACTIVE);
    const createdAt = randomDate(HISTORICAL_START, HISTORICAL_END);

    const user = await prisma.user.upsert({
      where: { email },
      update: { status },
      create: {
        email,
        passwordHash,
        name: `${fn} ${ln}`,
        phone: `+27 8${randomInt(1, 4)} ${randomInt(100, 999)} ${String(i).padStart(4, "0")}`,
        role: UserRole.CUSTOMER,
        status,
        emailVerifiedAt: status === UserStatus.ACTIVE ? createdAt : null,
        createdAt,
        customerProfile: { create: { displayName: `${fn} ${ln}` } },
      },
    });

    customerIds.push(user.id);
  }

  console.log(`   ✓ ${customerIds.length} customer accounts initialized.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 5. STORES & MERCHANTS (~40 Fictional Stores)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n5️⃣  Seeding 40 Fictional Stores & Merchant Staff...");

  const storesConfig = [
    { slug: "fresh-basket-grocers", name: "Fresh Basket Grocers", category: "GROCERIES", city: "Cape Town", province: "Western Cape" },
    { slug: "careplus-wellness", name: "CarePlus Health & Wellness", category: "PHARMACY", city: "Johannesburg", province: "Gauteng" },
    { slug: "artisan-bakery-cafe", name: "Artisan Bakery & Cafe", category: "BAKERY", city: "Cape Town", province: "Western Cape" },
    { slug: "techhub-electronics", name: "TechHub South Africa", category: "ELECTRONICS", city: "Pretoria", province: "Gauteng" },
    { slug: "cape-threads-studio", name: "Cape Threads Studio", category: "FASHION", city: "Cape Town", province: "Western Cape" },
    { slug: "living-spaces-home", name: "Living Spaces & Home", category: "HOME_LIVING", city: "Durban", province: "KwaZulu-Natal" },
    { slug: "stationery-depot-express", name: "Stationery Depot Express", category: "OFFICE", city: "Johannesburg", province: "Gauteng" },
    { slug: "highveld-fresh-market", name: "Highveld Fresh Market", category: "GROCERIES", city: "Pretoria", province: "Gauteng" },
    { slug: "kwazulu-baking-co", name: "KwaZulu Baking Co", category: "BAKERY", city: "Durban", province: "KwaZulu-Natal" },
    { slug: "table-mountain-books", name: "Table Mountain Books", category: "BOOKS", city: "Cape Town", province: "Western Cape" },
    { slug: "paw-fect-pet-boutique", name: "Paw-Fect Pet Boutique", category: "PETS", city: "Johannesburg", province: "Gauteng" },
    { slug: "fynbos-floral-design", name: "Fynbos Floral Design", category: "FLOWERS", city: "Cape Town", province: "Western Cape" },
    { slug: "tiny-tots-baby-co", name: "Tiny Tots Baby Co", category: "BABY", city: "Pretoria", province: "Gauteng" },
    { slug: "trailhead-outdoor-gear", name: "Trailhead Outdoor Gear", category: "SPORTS", city: "Mbombela", province: "Mpumalanga" },
    { slug: "safari-auto-spares", name: "Safari Auto Spares", category: "AUTO", city: "Polokwane", province: "Limpopo" },
    { slug: "heritage-leather-craft", name: "Heritage Leather Craft", category: "FOOTWEAR", city: "Gqeberha", province: "Eastern Cape" },
    { slug: "karoo-craft-furniture", name: "Karoo Craft Furniture", category: "FURNITURE", city: "Bloemfontein", province: "Free State" },
    { slug: "bistro-on-bree", name: "Bistro on Bree", category: "RESTAURANT", city: "Cape Town", province: "Western Cape" },
    { slug: "glow-apothecary", name: "Glow Apothecary", category: "BEAUTY", city: "Johannesburg", province: "Gauteng" },
    { slug: "high-tech-gadgets", name: "High-Tech Gadgets", category: "ELECTRONICS", city: "Durban", province: "KwaZulu-Natal" },
    { slug: "urban-style-lab", name: "Urban Style Lab", category: "FASHION", city: "Johannesburg", province: "Gauteng" },
    { slug: "greenhouse-hardware", name: "Greenhouse Hardware", category: "HARDWARE", city: "Pretoria", province: "Gauteng" },
    { slug: "zulu-beadwork-collective", name: "Zulu Beadwork Collective", category: "SPECIALTY", city: "Durban", province: "KwaZulu-Natal" },
    { slug: "sunshine-fresh-produce", name: "Sunshine Fresh Produce", category: "GROCERIES", city: "Gqeberha", province: "Eastern Cape" },
    { slug: "patisserie-de-cape", name: "Pâtisserie de Cape", category: "BAKERY", city: "Cape Town", province: "Western Cape" },
    { slug: "medimart-express", name: "MediMart Express", category: "PHARMACY", city: "Bloemfontein", province: "Free State" },
    { slug: "desk-work-solutions", name: "Desk & Work Solutions", category: "OFFICE", city: "Pretoria", province: "Gauteng" },
    { slug: "bark-whiskers-pantry", name: "Bark & Whiskers Pantry", category: "PETS", city: "Cape Town", province: "Western Cape" },
    { slug: "savanna-home-decor", name: "Savanna Home Decor", category: "HOME_LIVING", city: "Mbombela", province: "Mpumalanga" },
    { slug: "velo-cycle-sports", name: "Velo Cycle & Sports", category: "SPORTS", city: "Cape Town", province: "Western Cape" },
    { slug: "bushveld-braai-hardware", name: "Bushveld Braai & Hardware", category: "HARDWARE", city: "Polokwane", province: "Limpopo" },
    { slug: "cape-winelands-gifts", name: "Cape Winelands Gifts", category: "SPECIALTY", city: "Cape Town", province: "Western Cape" },
    // Inactive/Negative testing stores (33-40)
    { slug: "draft-merchant-store", name: "Draft Merchant Store", category: "GROCERIES", status: StoreStatus.PENDING, city: "Johannesburg", province: "Gauteng" },
    { slug: "pending-approval-bites", name: "Pending Approval Bites", category: "RESTAURANT", status: StoreStatus.PENDING, city: "Durban", province: "KwaZulu-Natal" },
    { slug: "suspended-tech-shop", name: "Suspended Tech Shop", category: "ELECTRONICS", status: StoreStatus.SUSPENDED, city: "Pretoria", province: "Gauteng" },
    { slug: "rejected-goods-emporium", name: "Rejected Goods Emporium", category: "SPECIALTY", status: StoreStatus.DISABLED, city: "Cape Town", province: "Western Cape" },
    { slug: "unpublished-corner-market", name: "Unpublished Corner Market", category: "GROCERIES", status: StoreStatus.PENDING, city: "Bloemfontein", province: "Free State" },
    { slug: "temporarily-closed-deli", name: "Temporarily Closed Deli", category: "BAKERY", status: StoreStatus.PENDING, city: "Gqeberha", province: "Eastern Cape" },
    { slug: "archived-fashion-outlet", name: "Archived Fashion Outlet", category: "FASHION", status: StoreStatus.DISABLED, city: "Polokwane", province: "Limpopo" },
    { slug: "inactive-pet-corner", name: "Inactive Pet Corner", category: "PETS", status: StoreStatus.SUSPENDED, city: "Mbombela", province: "Mpumalanga" },
  ];

  const storeMap = new Map<string, { id: string; slug: string; name: string; ownerUserId: string; status: StoreStatus }>();

  for (let idx = 0; idx < storesConfig.length; idx++) {
    const sc = storesConfig[idx]!;
    const ownerEmail = `store.owner.${String(idx + 1).padStart(2, "0")}@demo.ktcouriers.test`;
    const storeStatus = sc.status || StoreStatus.ACTIVE;

    const owner = await prisma.user.upsert({
      where: { email: ownerEmail },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: { email: ownerEmail, passwordHash, name: `${sc.name} Owner`, role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START },
    });

    await prisma.storeProfile.upsert({
      where: { userId: owner.id },
      update: { status: storeStatus },
      create: { userId: owner.id, storeName: sc.name, contactPerson: `${sc.name} Manager`, businessPhone: `+27 11 555 ${String(idx + 100).padStart(4, "0")}`, businessEmail: ownerEmail, status: storeStatus },
    });

    const store = await prisma.store.upsert({
      where: { slug: sc.slug },
      update: { status: storeStatus, ownerUserId: owner.id, name: sc.name },
      create: {
        name: sc.name,
        slug: sc.slug,
        status: storeStatus,
        ownerUserId: owner.id,
        contactName: `${sc.name} Manager`,
        contactEmail: ownerEmail,
        contactPhone: `+27 11 555 ${String(idx + 100).padStart(4, "0")}`,
        city: sc.city,
        province: sc.province,
        featured: idx < 8,
      },
    });

    storeMap.set(sc.slug, { id: store.id, slug: store.slug, name: store.name, ownerUserId: owner.id, status: storeStatus });
  }

  console.log(`   ✓ ${storeMap.size} stores initialized across South African metropolitan areas.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 6. DRIVERS (~80 Drivers)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n6️⃣  Seeding 80 Driver Accounts & Profiles...");

  const driverIds: string[] = [];
  const vehicleTypes = [VehicleType.MOTORBIKE, VehicleType.CAR, VehicleType.VAN, VehicleType.BICYCLE];

  for (let i = 1; i <= 80; i++) {
    const email = `driver.${String(i).padStart(3, "0")}@demo.ktcouriers.test`;
    const driverCode = `DRV-${1000 + i}`;
    const status = i > 75 ? DriverStatus.SUSPENDED : (i > 70 ? DriverStatus.PENDING_REVIEW : DriverStatus.ACTIVE);
    const availability = status === DriverStatus.ACTIVE ? (i % 3 === 0 ? DriverAvailability.ON_DELIVERY : (i % 2 === 0 ? DriverAvailability.AVAILABLE : DriverAvailability.OFFLINE)) : DriverAvailability.OFFLINE;
    const onboardingStatus = status === DriverStatus.ACTIVE ? DriverOnboardingStatus.APPROVED : DriverOnboardingStatus.PENDING_REVIEW;
    const fn = randomElement(saFirstNames);
    const ln = randomElement(saLastNames);

    const user = await prisma.user.upsert({
      where: { email },
      update: { status: UserStatus.ACTIVE },
      create: { email, passwordHash, name: `${fn} ${ln}`, phone: `+27 82 777 ${String(i).padStart(4, "0")}`, role: UserRole.DRIVER, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START },
    });

    const profile = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: { status, availability },
      create: {
        userId: user.id,
        driverCode,
        displayName: `${fn} ${ln}`,
        phone: `+27 82 777 ${String(i).padStart(4, "0")}`,
        active: status === DriverStatus.ACTIVE,
        status,
        availability,
        onboardingStatus,
        vehicleType: randomElement(vehicleTypes),
        vehicleRegistration: `GP ${randomInt(100, 999)}-${randomInt(100, 999)}`,
        maxConcurrentAssignments: i <= 10 ? 2 : 1,
      },
    });

    driverIds.push(profile.id);

    // Assign primary region
    const regId = Array.from(regionMap.values())[i % regionMap.size]!;
    await prisma.driverServiceRegion.upsert({
      where: { driverProfileId_deliveryRegionId: { driverProfileId: profile.id, deliveryRegionId: regId } },
      update: {},
      create: { driverProfileId: profile.id, deliveryRegionId: regId, isPrimary: true },
    });
  }

  console.log(`   ✓ ${driverIds.length} driver accounts seeded with regional service assignments.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 7. PROMOTERS (~50 Promoter Accounts)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n7️⃣  Seeding 50 Promoter Accounts & Referral Scenarios...");

  const promoterUserIds: string[] = [];
  for (let i = 1; i <= 50; i++) {
    const email = `promoter.${String(i).padStart(3, "0")}@demo.ktcouriers.test`;
    const code = `PROMO-${1000 + i}`;
    const fn = randomElement(saFirstNames);
    const ln = randomElement(saLastNames);
    const isSuspended = i > 46;
    const recStatus = isSuspended ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
    const accStatus = isSuspended ? PromoterAccountStatus.SUSPENDED : PromoterAccountStatus.ACTIVE;

    const user = await prisma.user.upsert({
      where: { email },
      update: { status: UserStatus.ACTIVE },
      create: { email, passwordHash, name: `${fn} ${ln}`, role: UserRole.PROMOTER, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START },
    });

    await prisma.promoterProfile.upsert({
      where: { userId: user.id },
      update: { status: recStatus },
      create: { userId: user.id, promoterCode: code, displayName: `${fn} ${ln}`, phone: `+27 83 888 ${String(i).padStart(4, "0")}`, status: recStatus },
    });

    await prisma.promoterAccount.upsert({
      where: { userId: user.id },
      update: { status: accStatus },
      create: {
        publicReference: `PROMO-ACC-${1000 + i}`,
        userId: user.id,
        legalName: `${fn} ${ln}`,
        displayName: `${fn} ${ln}`,
        status: accStatus,
        identityStatus: "VERIFIED",
        taxProfileStatus: "READY",
        payoutReadinessStatus: "READY",
        agreementStatus: "ACCEPTED",
        activatedAt: HISTORICAL_START,
        approvedAt: HISTORICAL_START,
      },
    });

    promoterUserIds.push(user.id);
  }

  console.log(`   ✓ ${promoterUserIds.length} promoter accounts seeded.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 8. RECRUITMENT (~12 Vacancies, ~240 Applicants)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n8️⃣  Seeding Recruitment Vacancies & Applicant Lifecycle Pipeline...");

  const vacanciesData = [
    { code: "VAC-DRIVER-01", title: "Same-Day Delivery Courier", dept: "Operations", city: "Cape Town" },
    { code: "VAC-DRIVER-02", title: "Express Freight Driver", dept: "Operations", city: "Johannesburg" },
    { code: "VAC-OPS-01", title: "Regional Dispatch Coordinator", dept: "Operations", city: "Pretoria" },
    { code: "VAC-SUPPORT-01", title: "Customer Care Specialist", dept: "Support", city: "Cape Town" },
    { code: "VAC-MERCHANT-01", title: "Store Onboarding Specialist", dept: "Sales", city: "Johannesburg" },
    { code: "VAC-FINANCE-01", title: "Settlement Finance Assistant", dept: "Finance", city: "Johannesburg" },
    { code: "VAC-DEV-01", title: "Software Support Specialist", dept: "Engineering", city: "Cape Town" },
    { code: "VAC-HR-01", title: "Recruitment Coordinator", dept: "Human Resources", city: "Johannesburg" },
    { code: "VAC-CATALOG-01", title: "Marketplace Catalog Auditor", dept: "Catalog", city: "Cape Town" },
    { code: "VAC-MARKETING-01", title: "Promoter Network Manager", dept: "Marketing", city: "Durban" },
    { code: "VAC-QA-01", title: "Quality Assurance Specialist", dept: "Engineering", city: "Cape Town" },
    { code: "VAC-LOGISTICS-01", title: "Fleet Maintenance Inspector", dept: "Operations", city: "Pretoria" },
  ];

  const vacancyIds: string[] = [];
  const recruiterUser = await prisma.user.findFirstOrThrow({ where: { email: "recruiter.01@demo.ktcouriers.test" } });

  for (const v of vacanciesData) {
    const record = await prisma.vacancy.create({
      data: {
        title: v.title,
        type: v.dept,
        description: `Join KT Couriers as a ${v.title} in our ${v.city} hub.`,
        requirements: { details: "Relevant experience, valid SA ID/Permit, clean record." },
        status: VacancyStatus.OPEN,
        createdByUserId: recruiterUser.id,
      },
    });
    vacancyIds.push(record.id);
  }

  let applicantCount = 0;
  for (let i = 1; i <= 240; i++) {
    const email = `applicant.${String(i).padStart(3, "0")}@demo.ktcouriers.test`;
    const fn = randomElement(saFirstNames);
    const ln = randomElement(saLastNames);
    const vacId = vacancyIds[i % vacancyIds.length]!;

    const user = await prisma.user.upsert({
      where: { email },
      update: { status: UserStatus.ACTIVE },
      create: { email, passwordHash, name: `${fn} ${ln}`, role: UserRole.CUSTOMER, status: UserStatus.ACTIVE, emailVerifiedAt: HISTORICAL_START },
    });

    await prisma.vacancyApplication.create({
      data: {
        vacancyId: vacId,
        userId: user.id,
        fullName: `${fn} ${ln}`,
        email,
        phone: `+27 84 999 ${String(i).padStart(4, "0")}`,
        status: randomElement([RecruitmentApplicationStatus.SUBMITTED, RecruitmentApplicationStatus.UNDER_REVIEW, RecruitmentApplicationStatus.SHORTLISTED, RecruitmentApplicationStatus.APPROVED, RecruitmentApplicationStatus.REJECTED]),
      },
    });
    applicantCount++;
  }

  console.log(`   ✓ ${vacancyIds.length} vacancies and ${applicantCount} applicant applications seeded.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 9. MARKETPLACE CATALOG (~800 Products across 32 ACTIVE stores)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n9️⃣  Seeding Marketplace Catalog, Categories, Media & Snapshots...");

  const productTypes = [
    { code: "GROCERIES", name: "Groceries & Food" },
    { code: "HEALTH_WELLNESS", name: "Health & Wellness" },
    { code: "PREPARED_FOOD", name: "Prepared Food & Bakery" },
    { code: "ELECTRONICS", name: "Electronics & Tech" },
    { code: "FASHION", name: "Fashion & Apparel" },
    { code: "HOME_LIVING", name: "Home & Living" },
    { code: "OFFICE_SUPPLIES", name: "Office Supplies" },
  ];

  const productTypeMap = new Map<string, { id: string; code: string; versionNumber: number }>();
  for (const pt of productTypes) {
    const record = await prisma.productTypeDefinition.upsert({
      where: { code_versionNumber: { code: pt.code, versionNumber: 1 } },
      update: { name: pt.name, status: "ACTIVE" },
      create: {
        publicReference: catalogPublicReference("PTD"),
        code: pt.code,
        versionNumber: 1,
        name: pt.name,
        status: "ACTIVE",
        searchFacetSchema: { facets: [{ code: "brand", public: true }] },
        attributeSchema: {},
        variantSchema: {},
        complianceSchema: {},
        createdByUserId: superAdmin.id,
      },
    });
    productTypeMap.set(pt.code, { id: record.id, code: record.code, versionNumber: record.versionNumber });
  }

  const categoryTree = [
    { ref: "CC-GROCERIES", name: "Groceries", slug: "groceries", path: "groceries", ptCode: "GROCERIES" },
    { ref: "CC-FRESH-PRODUCE", name: "Fresh Produce", slug: "fresh-produce", path: "groceries/fresh-produce", parentRef: "CC-GROCERIES", ptCode: "GROCERIES" },
    { ref: "CC-PHARMACY", name: "Pharmacy & Health", slug: "pharmacy", path: "pharmacy", ptCode: "HEALTH_WELLNESS" },
    { ref: "CC-PERSONAL-CARE", name: "Personal Care", slug: "personal-care", path: "pharmacy/personal-care", parentRef: "CC-PHARMACY", ptCode: "HEALTH_WELLNESS" },
    { ref: "CC-BAKERY", name: "Bakery & Coffee", slug: "bakery-coffee", path: "bakery-coffee", ptCode: "PREPARED_FOOD" },
    { ref: "CC-ELECTRONICS", name: "Electronics", slug: "electronics", path: "electronics", ptCode: "ELECTRONICS" },
    { ref: "CC-FASHION", name: "Fashion", slug: "fashion", path: "fashion", ptCode: "FASHION" },
    { ref: "CC-HOME", name: "Home & Living", slug: "home-living", path: "home-living", ptCode: "HOME_LIVING" },
    { ref: "CC-OFFICE", name: "Office Supplies", slug: "office-supplies", path: "office-supplies", ptCode: "OFFICE_SUPPLIES" },
  ];

  const categoryMap = new Map<string, { id: string; publicReference: string; path: string; name: string }>();
  for (const c of categoryTree.filter((cat) => !cat.parentRef)) {
    const rec = await prisma.catalogCategory.upsert({
      where: { publicReference: c.ref },
      update: { name: c.name, path: c.path, status: "ACTIVE" },
      create: { publicReference: c.ref, name: c.name, slug: c.slug, path: c.path, description: c.name, status: "ACTIVE", createdByUserId: superAdmin.id, updatedByUserId: superAdmin.id },
    });
    categoryMap.set(c.ref, { id: rec.id, publicReference: rec.publicReference, path: rec.path, name: rec.name });
  }

  for (const c of categoryTree.filter((cat) => cat.parentRef)) {
    const parent = categoryMap.get(c.parentRef!);
    const rec = await prisma.catalogCategory.upsert({
      where: { publicReference: c.ref },
      update: { name: c.name, path: c.path, status: "ACTIVE", parentId: parent?.id },
      create: { publicReference: c.ref, name: c.name, slug: c.slug, path: c.path, description: c.name, status: "ACTIVE", parentId: parent?.id, createdByUserId: superAdmin.id, updatedByUserId: superAdmin.id },
    });
    categoryMap.set(c.ref, { id: rec.id, publicReference: rec.publicReference, path: rec.path, name: rec.name });
  }

  // Local Catalog Media
  const mediaFiles = [
    "/images/kt-couriers/box-sealing-order-prep.webp",
    "/images/kt-couriers/small-business-delivery-counter.webp",
    "/images/kt-couriers/store-merchandise-packing.webp",
    "/images/kt-couriers/labelled-parcel-preparation.webp",
    "/images/kt-couriers/hands-exchanging-delivery-packages.webp",
    "/images/kt-couriers/parcel-packing-close-up.webp",
    "/images/kt-couriers/parcel-handoff-customer.webp",
  ];

  const mediaAssetList: string[] = [];
  for (let i = 0; i < mediaFiles.length; i++) {
    const key = mediaFiles[i]!;
    const ref = `CMA-DEV-FULL-${i + 1}`;
    const { checksum, byteSize } = computeFileSHA256(key);
    const asset = await prisma.catalogMediaAsset.upsert({
      where: { publicReference: ref },
      update: { status: "READY" },
      create: {
        publicReference: ref,
        ownerType: "PLATFORM",
        purpose: "PRODUCT_IMAGE",
        storageKey: `catalog-media/${checksum}`,
        storageProvider: "LOCAL_DEV",
        declaredMimeType: "image/webp",
        mimeType: "image/webp",
        declaredByteSize: byteSize,
        byteSize,
        width: 1200,
        height: 1200,
        checksum,
        privacyInspectionPassed: true,
        status: "READY",
        storageConfirmedAt: HISTORICAL_START,
        validatedAt: HISTORICAL_START,
        createdByUserId: superAdmin.id,
        updatedByUserId: superAdmin.id,
      },
    });
    mediaAssetList.push(asset.id);
  }

  // Seed Products across ACTIVE stores (stores 1 to 32)
  console.log("   📦 Compiling Published Products & Snapshots across active stores...");

  const baseProductTitles = [
    { title: "Organic Hass Avocados Pack", cat: "CC-FRESH-PRODUCE", pt: "GROCERIES", price: 48.5 },
    { title: "Fresh Gala Apples Bag", cat: "CC-FRESH-PRODUCE", pt: "GROCERIES", price: 34.9 },
    { title: "Free-Range Large Eggs 18s", cat: "CC-GROCERIES", pt: "GROCERIES", price: 62.0 },
    { title: "Full Cream Milk 2L", cat: "CC-GROCERIES", pt: "GROCERIES", price: 36.5 },
    { title: "Extra Virgin Olive Oil 750ml", cat: "CC-GROCERIES", pt: "GROCERIES", price: 145.0 },
    { title: "Vitamin C 1000mg Effervescent", cat: "CC-PHARMACY", pt: "HEALTH_WELLNESS", price: 79.0 },
    { title: "Botanical Body Wash 500ml", cat: "CC-PERSONAL-CARE", pt: "HEALTH_WELLNESS", price: 115.0 },
    { title: "Country Sourdough Bread", cat: "CC-BAKERY", pt: "PREPARED_FOOD", price: 45.0 },
    { title: "Single Origin Espresso Beans 1kg", cat: "CC-BAKERY", pt: "PREPARED_FOOD", price: 285.0 },
    { title: "Braided USB-C Fast Charging Cable", cat: "CC-ELECTRONICS", pt: "ELECTRONICS", price: 165.0 },
    { title: "GaN 65W Dual Port Charger", cat: "CC-ELECTRONICS", pt: "ELECTRONICS", price: 499.0 },
    { title: "Pure Flax Linen Oversized Shirt", cat: "CC-FASHION", pt: "FASHION", price: 650.0 },
    { title: "Handcrafted Bovine Leather Tote", cat: "CC-FASHION", pt: "FASHION", price: 1250.0 },
    { title: "Ceramic Artisan Coffee Mugs", cat: "CC-HOME", pt: "HOME_LIVING", price: 320.0 },
    { title: "A5 Hardcover Bullet Grid Journal", cat: "CC-OFFICE", pt: "OFFICE_SUPPLIES", price: 195.0 },
  ];

  const storesList = Array.from(storeMap.values());
  const activeStores = storesList.filter((s) => s.status === StoreStatus.ACTIVE);

  let totalProducts = 0;
  let totalVariants = 0;

  for (let sIdx = 0; sIdx < activeStores.length; sIdx++) {
    const store = activeStores[sIdx]!;
    const productCount = sIdx < 8 ? 40 : 20;

    for (let pIdx = 0; pIdx < productCount; pIdx++) {
      const template = baseProductTitles[(sIdx + pIdx) % baseProductTitles.length]!;
      const prodRef = `CP-FULL-${sIdx + 1}-${pIdx + 1}`;
      const title = `${template.title} (${store.name})`;
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${prodRef.toLowerCase()}`;

      const cat = categoryMap.get(template.cat)!;
      const pt = productTypeMap.get(template.pt)!;

      // 1. Create product in DRAFT status
      const product = await prisma.catalogProduct.upsert({
        where: { publicReference: prodRef },
        update: {},
        create: {
          publicReference: prodRef,
          title,
          normalizedTitle: title.toUpperCase(),
          slug,
          scope: "GLOBAL_CANONICAL",
          status: "DRAFT",
          moderationStatus: "APPROVED",
          publicationStatus: "PUBLISHED",
          version: 1,
          shortDescription: `Quality ${title} from ${store.name}.`,
          description: `Authentic ${title} provided directly by ${store.name} for KT Couriers delivery.`,
          condition: "NEW",
          primaryCategoryId: cat.id,
          productTypeDefinitionId: pt.id,
          productTypeVersionNumber: pt.versionNumber,
          attributeValues: {},
          complianceValues: {},
          qualityIssues: [],
          createdByUserId: superAdmin.id,
        },
      });
      totalProducts++;

      // 2. Attach Media
      const mediaAssetId = mediaAssetList[(sIdx + pIdx) % mediaAssetList.length]!;
      await prisma.catalogProductMedia.deleteMany({ where: { productId: product.id } });
      await prisma.catalogProductMedia.create({
        data: { productId: product.id, assetId: mediaAssetId, role: "PRIMARY", altText: title, displayOrder: 1 },
      });

      // 3. Create Variants
      const variantCount = (pIdx % 2 === 0) ? 2 : 1;
      const createdVariantIds: string[] = [];

      for (let vIdx = 0; vIdx < variantCount; vIdx++) {
        const varRef = `CPV-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;
        const varTitle = vIdx === 0 ? "Standard Edition" : "Premium Bulk Pack";

        const variant = await prisma.catalogProductVariant.upsert({
          where: { publicReference: varRef },
          update: { status: "ACTIVE" },
          create: {
            publicReference: varRef,
            productId: product.id,
            title: varTitle,
            normalizedTitle: varTitle.toUpperCase(),
            optionFingerprint: varRef,
            skuReference: `SKU-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`,
            status: "ACTIVE",
            attributeValues: {},
          },
        });
        totalVariants++;
        createdVariantIds.push(variant.id);
      }

      // 4. Update Product to ACTIVE
      await prisma.catalogProduct.update({
        where: { id: product.id },
        data: { status: "ACTIVE", moderationStatus: "APPROVED", publicationStatus: "PUBLISHED" },
      });

      // 5. Create Offers, Price Versions & Inventory with Movement Evidence
      for (let vIdx = 0; vIdx < variantCount; vIdx++) {
        const varRef = `CPV-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;
        const varTitle = vIdx === 0 ? "Standard Edition" : "Premium Bulk Pack";
        const priceAmount = template.price * (vIdx === 0 ? 1 : 1.8);
        const variantId = createdVariantIds[vIdx]!;

        const offerRef = `SCO-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;
        const priceRef = `SOPV-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;

        // 5a. Create Offer in DRAFT
        const offer = await prisma.storeCatalogOffer.upsert({
          where: { publicReference: offerRef },
          update: { publicationStatus: "PUBLISHED" },
          create: {
            publicReference: offerRef,
            storeId: store.id,
            productId: product.id,
            variantId,
            storeSku: `SKU-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`,
            fulfilmentMode: "COURIER_DELIVERY",
            sellingUnit: "EACH",
            status: "DRAFT",
            publicationStatus: "PUBLISHED",
            inventoryTrackingMode: "TRACKED",
            createdByUserId: superAdmin.id,
          },
        });

        // 5b. Create Price Version
        const priceVersion = await prisma.storeOfferPriceVersion.upsert({
          where: { publicReference: priceRef },
          update: { amount: priceAmount, status: "ACTIVE" },
          create: {
            publicReference: priceRef,
            offerId: offer.id,
            versionNumber: 1,
            amount: priceAmount,
            currency: "ZAR",
            priceIncludesTax: true,
            status: "ACTIVE",
            effectiveFrom: HISTORICAL_START,
            createdByUserId: superAdmin.id,
          },
        });

        // 5c. Update Offer to ACTIVE with currentPriceVersionId
        await prisma.storeCatalogOffer.update({
          where: { id: offer.id },
          data: { currentPriceVersionId: priceVersion.id, status: "ACTIVE", publicationStatus: "PUBLISHED" },
        });

        // 5d. Inventory Item & Location
        const invItem = await prisma.catalogInventoryItem.upsert({
          where: { offerId: offer.id },
          update: {},
          create: { publicReference: `CII-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`, offerId: offer.id, variantId, trackingMode: "TRACKED" },
        });

        const invLoc = await prisma.inventoryLocation.upsert({
          where: { storeId_name: { storeId: store.id, name: "Main Store Floor" } },
          update: {},
          create: { publicReference: `IL-FULL-${store.id}`, storeId: store.id, name: "Main Store Floor", status: "ACTIVE", isPrimary: true },
        });

        // 5e. Inventory Movement Evidence (Required before CatalogInventoryLevel)
        const opId = `OP-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;
        const cimRef = `CIM-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;
        const reqHash = createHash("sha256").update(opId).digest("hex");

        const existingMovement = await prisma.catalogInventoryMovement.findUnique({
          where: { inventoryItemId_operationId: { inventoryItemId: invItem.id, operationId: opId } },
        });

        if (!existingMovement) {
          await prisma.catalogInventoryMovement.create({
            data: {
              publicReference: cimRef,
              inventoryItemId: invItem.id,
              locationId: invLoc.id,
              type: "INITIAL_STOCK",
              quantityDelta: 100,
              operationId: opId,
              requestHash: reqHash,
              reasonCode: "INITIAL_DEMO_SEED",
              safeNote: "Initial stock count for full demonstration dataset",
              actorUserId: superAdmin.id,
              resultingOnHand: 100,
            },
          });
        }

        // 5f. Inventory Level
        await prisma.catalogInventoryLevel.upsert({
          where: { inventoryItemId_locationId: { inventoryItemId: invItem.id, locationId: invLoc.id } },
          update: { available: 100, onHand: 100, reserved: 0 },
          create: { inventoryItemId: invItem.id, locationId: invLoc.id, available: 100, onHand: 100, reserved: 0 },
        });

        // 5g. Publication Snapshot
        const snapshotRef = `CPS-FULL-${sIdx + 1}-${pIdx + 1}-${vIdx + 1}`;
        const snapshotPayload = buildCatalogPublicationSnapshot({
          productReference: product.publicReference,
          variantReference: varRef,
          offerReference: offer.publicReference,
          storeReference: store.slug,
          productTypeCode: pt.code,
          productTypeVersion: pt.versionNumber,
          categoryPath: cat.path,
          title: product.title,
          description: product.description || "",
          identifiers: {},
          attributes: {},
          variantOptions: { option: varTitle },
          price: { versionReference: priceVersion.publicReference, amount: priceAmount.toFixed(2), currency: "ZAR", includesTax: true },
          availability: { state: "IN_STOCK" },
          media: [{ assetReference: `CMA-DEV-FULL-${(sIdx + pIdx) % mediaFiles.length + 1}`, role: "PRIMARY", altText: product.title, order: 1 }],
          compliance: {},
        });

        const snapshotRecord = await prisma.catalogPublicationSnapshot.upsert({
          where: { publicReference: snapshotRef },
          update: {},
          create: {
            publicReference: snapshotRef,
            versionNumber: 1,
            publicationVersion: snapshotPayload.publicationVersion,
            productId: product.id,
            variantId,
            offerId: offer.id,
            status: "PUBLISHED",
            snapshot: toInputJsonObject(snapshotPayload),
            createdByUserId: superAdmin.id,
          },
        });

        await projectionService.buildPublishedSnapshot(snapshotRecord.publicReference);
      }
    }
  }

  console.log(`   ✓ ${totalProducts} published catalog products and ${totalVariants} variants compiled into Storefront Documents.`);

  // Rebuild storefront store & category documents
  for (const s of activeStores) {
    await rebuildStorefrontStoreDocument(s.id);
  }
  for (const c of categoryMap.values()) {
    await rebuildStorefrontCategoryDocument(c.id);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 10. COURIER ORDERS (~2,500 Delivery Orders across 13 Months)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n🔟 Seeding ~2,500 Courier Delivery Orders & Status History...");

  const jhbRegId = regionMap.get("johannesburg-metro")!;
  const cptRegId = regionMap.get("cape-town-metro")!;
  const dbnRegId = regionMap.get("durban-metro")!;

  let totalCourierOrders = 0;
  for (let i = 1; i <= 2500; i++) {
    const orderNumber = `ORD-KT-${20250000 + i}`;
    const customerId = customerIds[i % customerIds.length]!;
    const storeObj = activeStores[i % activeStores.length]!;
    const regId = (i % 3 === 0) ? cptRegId : ((i % 3 === 1) ? jhbRegId : dbnRegId);
    const createdAt = randomDate(HISTORICAL_START, HISTORICAL_END);

    // Status distribution
    let status: OrderStatus = OrderStatus.DELIVERED;
    if (i > 2375) status = OrderStatus.IN_TRANSIT;
    else if (i > 2250) status = OrderStatus.PENDING;
    else if (i > 2125) status = OrderStatus.CANCELLED;
    else if (i > 2000) status = OrderStatus.FAILED;

    const price = randomInt(65, 350);

    const pickup = await prisma.address.create({
      data: { type: AddressType.PICKUP, line1: `${randomInt(1, 150)} Main Road`, city: storeObj.name.includes("Cape") ? "Cape Town" : "Johannesburg", country: "South Africa", latitude: -26.2041, longitude: 28.0473 },
    });

    const dropoff = await prisma.address.create({
      data: { type: AddressType.DROPOFF, line1: `${randomInt(1, 200)} Residential Drive`, city: storeObj.name.includes("Cape") ? "Cape Town" : "Johannesburg", country: "South Africa", latitude: -26.2500, longitude: 28.0800 },
    });

    const order = await prisma.order.upsert({
      where: { orderNumber },
      update: { status },
      create: {
        orderNumber,
        source: OrderSource.CUSTOMER,
        status,
        deliveryType: randomElement([DeliveryType.SAME_DAY, DeliveryType.SCHEDULED, DeliveryType.BUSINESS, DeliveryType.PARCEL_DOCUMENT]),
        currency: "ZAR",
        customerId,
        storeId: storeObj.id,
        pickupAddressId: pickup.id,
        dropoffAddressId: dropoff.id,
        recipientName: "Receiver Customer",
        recipientPhone: "+27 82 000 9999",
        parcelDescription: "General Merchandise Package",
        parcelCount: randomInt(1, 3),
        priceEstimate: price,
        pricingSubtotal: price * 0.85,
        pricingTaxAmount: price * 0.15,
        deliveryRegionId: regId,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status, note: `Status updated to ${status} during historical workflow simulation.`, createdAt },
    });



    // Create Payment record for completed/historical order
    const pRef = `PAY-ORD-${20250000 + i}`;
    const pStatus = (status === OrderStatus.CANCELLED || status === OrderStatus.FAILED) ? PaymentStatus.FAILED : PaymentStatus.SUCCEEDED;
    
    await seedPaymentWithEvidence({
      publicReference: pRef,
      userId: customerId,
      orderId: order.id,
      subjectType: PaymentSubjectType.COURIER_ORDER,
      purpose: PaymentPurpose.ORDER,
      status: pStatus,
      amount: price,
      creationIdempotencyKey: `IDEM-PAY-ORD-${i}`,
      orderNumber,
      createdAt,
    });

    totalCourierOrders++;
  }

  console.log(`   ✓ ${totalCourierOrders} courier delivery orders & payment journals seeded.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 11. MARKETPLACE ORDERS (~1,600 Marketplace Orders)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣1️⃣ Seeding ~1,600 Marketplace Store Orders...");

  let totalMarketplaceOrders = 0;
  for (let i = 1; i <= 1600; i++) {
    const orderNumber = `MKT-ORD-${20250000 + i}`;
    const customerId = customerIds[i % customerIds.length]!;
    const storeObj = activeStores[i % activeStores.length]!;
    const createdAt = randomDate(HISTORICAL_START, HISTORICAL_END);

    const totalAmount = randomInt(120, 850);
    const deliveryFee = 45;
    const merchandiseSubtotal = totalAmount - deliveryFee;

    const chkRef = `MKT-CHK-${20250000 + i}`;
    const cartRef = `MKT-CART-${20250000 + i}`;

    const cart = await prisma.marketplaceCart.upsert({
      where: { publicReference: cartRef },
      update: {},
      create: {
        publicReference: cartRef,
        ownerType: "CUSTOMER",
        customerUserId: customerId,
        status: "CONVERTED",
        currency: LedgerCurrency.ZAR,
        createdAt,
      },
    });

    const checkout = await prisma.marketplaceCheckout.upsert({
      where: { publicReference: chkRef },
      update: {},
      create: {
        publicReference: chkRef,
        cartId: cart.id,
        customerUserId: customerId,
        status: "COMPLETED",
        currency: LedgerCurrency.ZAR,
        merchandiseSubtotal,
        modifierSubtotal: 0,
        deliveryFeeTotal: deliveryFee,
        grandTotal: totalAmount,
        createdAt,
      },
    });

    const pRef = `PAY-MKT-${20250000 + i}`;
    const payment = await seedPaymentWithEvidence({
      publicReference: pRef,
      userId: customerId,
      marketplaceCheckoutId: checkout.id,
      subjectType: PaymentSubjectType.MARKETPLACE_CHECKOUT,
      purpose: PaymentPurpose.ORDER,
      status: PaymentStatus.SUCCEEDED,
      amount: totalAmount,
      creationIdempotencyKey: `IDEM-PAY-MKT-${i}`,
      orderNumber,
      createdAt,
    });

    const mktOrder = await prisma.marketplaceOrder.upsert({
      where: { publicReference: orderNumber },
      update: { status: i > 1520 ? "CANCELLED" : "CONFIRMED" },
      create: {
        publicReference: orderNumber,
        checkoutId: checkout.id,
        paymentId: payment.id,
        customerUserId: customerId,
        currency: LedgerCurrency.ZAR,
        grandTotal: totalAmount,
        merchandiseSubtotal,
        modifierSubtotal: 0,
        deliveryFeeTotal: deliveryFee,
        status: i > 1520 ? "CANCELLED" : "CONFIRMED",
        commercialFingerprint: createHash("sha256").update(orderNumber).digest("hex"),
        createdAt,
      },
    });

    const storeGroup = await prisma.marketplaceCheckoutStoreGroup.upsert({
      where: { checkoutId_storeId: { checkoutId: checkout.id, storeId: storeObj.id } },
      update: {},
      create: {
        checkoutId: checkout.id,
        storeId: storeObj.id,
        fulfilmentMode: "COURIER_DELIVERY",
        merchandiseSubtotal,
        modifierSubtotal: 0,
        deliveryFee,
        groupTotal: totalAmount,
      },
    });

    await prisma.marketplaceStoreOrder.upsert({
      where: { publicReference: `MSO-${1000 + i}` },
      update: { status: "SETTLED" },
      create: {
        publicReference: `MSO-${1000 + i}`,
        marketplaceOrderId: mktOrder.id,
        checkoutStoreGroupId: storeGroup.id,
        storeId: storeObj.id,
        status: "SETTLED",
        currency: LedgerCurrency.ZAR,
        merchandiseSubtotal,
        modifierSubtotal: 0,
        deliveryFee,
        groupTotal: totalAmount,
        createdAt,
      },
    });

    totalMarketplaceOrders++;
  }

  console.log(`   ✓ ${totalMarketplaceOrders} marketplace orders, checkouts & payments seeded.`);

  // ───────────────────────────────────────────────────────────────────────────
  // 12. NOTIFICATIONS & REPORTS HISTORY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n1️⃣2️⃣ Seeding Notifications, Reports & Webhook Artifacts...");

  // Seed Report Definitions
  const reportDefs = [
    { key: "ADMIN_OPERATIONAL_SUMMARY", name: "Admin Operational Summary", audience: ReportAudience.ADMINISTRATOR },
    { key: "STORE_EARNINGS_SETTLEMENT", name: "Store Earnings & Settlement", audience: ReportAudience.STORE },
    { key: "DRIVER_EARNINGS_STATEMENT", name: "Driver Earnings Statement", audience: ReportAudience.DRIVER },
    { key: "PROMOTER_PERFORMANCE_REPORT", name: "Promoter Performance Report", audience: ReportAudience.PROMOTER },
    { key: "RECRUITMENT_PIPELINE_METRICS", name: "Recruitment Pipeline Metrics", audience: ReportAudience.RECRUITMENT },
    { key: "DEVELOPER_API_USAGE", name: "Developer API Usage & Latency", audience: ReportAudience.DEVELOPER },
  ];

  for (const r of reportDefs) {
    const def = await prisma.reportDefinition.upsert({
      where: { key: r.key },
      update: { name: r.name },
      create: {
        publicReference: catalogPublicReference("RPD"),
        key: r.key,
        name: r.name,
        description: `Canonical report definition for ${r.name}.`,
        audience: r.audience,
        requiredPermission: "reports:view",
        resourceOwnerRule: "GLOBAL",
        allowedFormats: ["CSV", "JSON"],
        allowedFilters: {},
        maximumRowCount: 10000,
        active: true,
      },
    });

    await prisma.reportDefinitionVersion.upsert({
      where: { definitionId_version: { definitionId: def.id, version: 1 } },
      update: {},
      create: {
        publicReference: catalogPublicReference("RDV"),
        definitionId: def.id,
        version: 1,
        frozenSnapshot: { key: r.key, name: r.name },
      },
    });

    const job = await prisma.reportJob.upsert({
      where: { publicReference: `RPJ-${r.key}` },
      update: { status: ReportJobStatus.COMPLETED },
      create: {
        publicReference: `RPJ-${r.key}`,
        definitionKey: r.key,
        definitionVersion: 1,
        requesterUserId: superAdmin.id,
        requesterRole: "SUPER_ADMIN",
        ownerScope: {},
        permissionSnapshot: {},
        normalizedFilters: {},
        filterHash: "default",
        executionMode: ReportExecutionMode.ASYNCHRONOUS_EXPORT,
        outputFormat: ReportExportFormat.CSV,
        status: ReportJobStatus.COMPLETED,
        rowCount: 150,
        requestHash: createHash("sha256").update(r.key).digest("hex"),
      },
    });

    await prisma.reportExportArtifact.upsert({
      where: { jobId: job.id },
      update: {},
      create: {
        publicReference: `RPA-${r.key}`,
        jobId: job.id,
        format: ReportExportFormat.CSV,
        storageKey: `reports/${r.key}.csv`,
        contentType: "text/csv",
        byteSize: 12400,
        checksum: createHash("sha256").update(r.key).digest("hex"),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
  }

  // Seed 100 In-App & Outbox Notifications
  for (let i = 1; i <= 100; i++) {
    const recipientUserId = customerIds[i % customerIds.length]!;
    await prisma.notification.create({
      data: {
        userId: recipientUserId,
        channel: "IN_APP",
        status: "DELIVERED",
        eventType: "order.status.updated",
        title: `Order Update #${i}`,
        body: `Your KT Couriers delivery #${i} status has been updated.`,
        sentAt: randomDate(HISTORICAL_START, HISTORICAL_END),
        createdAt: randomDate(HISTORICAL_START, HISTORICAL_END),
      },
    });
  }

  console.log("   ✓ Report definitions, jobs, artifacts and 100 notification logs seeded.");

  // Save Seed Manifest
  const manifestDir = join(process.cwd(), "docs", "demo-data");
  if (!existsSync(manifestDir)) mkdirSync(manifestDir, { recursive: true });

  const manifest = {
    seedVersion: "1.0.0",
    seedRunId: SEED_RUN_ID,
    randomSeed: RANDOM_SEED,
    creationTime: new Date().toISOString(),
    datasetPeriod: { start: HISTORICAL_START.toISOString(), end: HISTORICAL_END.toISOString() },
    entityCounts: {
      users: await prisma.user.count(),
      stores: await prisma.store.count(),
      drivers: await prisma.driverProfile.count(),
      promoters: await prisma.promoterProfile.count(),
      vacancies: await prisma.vacancy.count(),
      applications: await prisma.vacancyApplication.count(),
      products: await prisma.catalogProduct.count(),
      variants: await prisma.catalogProductVariant.count(),
      courierOrders: await prisma.order.count(),
      marketplaceOrders: await prisma.marketplaceOrder.count(),
      notifications: await prisma.notification.count(),
      reportJobs: await prisma.reportJob.count(),
    },
    checksum: createHash("sha256").update(SEED_RUN_ID).digest("hex"),
    completionStatus: "SUCCESS",
  };

  writeFileSync(join(manifestDir, "full-demo-manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Full Demo Dataset Seeding Complete in ${durationSec}s!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
