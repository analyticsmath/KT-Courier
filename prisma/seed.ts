/**
 * KT Couriers — Development Seed Script (Phase 1.4)
 *
 * DEVELOPMENT ONLY — never run against a production database.
 * Demo credentials are documented in docs/development-seed.md.
 * Real passwords must be set via environment variables in production.
 *
 * Run: npx prisma db seed
 *   or: npm run prisma:seed
 */

import { PrismaClient, UserRole, UserStatus, SystemSettingType, DeliveryType, DriverStatus, DriverAvailability, DriverOnboardingStatus, VehicleType, OrderStatus, OrderSource, AddressType, OrderAssignmentStatus, LedgerAccountPurpose } from "@prisma/client";
import bcrypt from "bcryptjs";
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
  FOUNDATION_STORE_EARNING_ACCOUNT,
  FOUNDATION_STORE_EARNING_JOURNAL_TYPES,
  FOUNDATION_DRIVER_EARNING_ACCOUNT,
  FOUNDATION_DRIVER_EARNING_JOURNAL_TYPES,
} from "../lib/constants/foundation-models";

import { assertSeedExecutionAllowed } from "../lib/security/seed-safety";

const prisma = new PrismaClient();

// Demo password for all seeded accounts — change before any real deployment.
// Documented in docs/development-seed.md.
const DEMO_PASSWORD = "ChangeMe123!";
const SALT_ROUNDS = 12;

async function main() {
  assertSeedExecutionAllowed();

  const dbUrl = process.env.DATABASE_URL || "";
  const isLocalDb = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") || dbUrl.includes("db:5432") || dbUrl.includes("db:5433");
  if (!isLocalDb) {
    throw new Error("❌ ERROR: Development seed script refused to run! Target database host is not a recognized local or compose database.");
  }

  console.log("🌱  Starting KT Couriers development seed...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // ── Super Admin ───────────────────────────────────────────────────────────

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@ktcouriers.local" },
    update: {},
    create: {
      email: "superadmin@ktcouriers.local",
      passwordHash,
      name: "KT Super Admin",
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      adminProfile: {
        create: {
          displayName: "KT Super Admin",
          jobTitle: "Super Administrator",
        },
      },
    },
  });

  console.log(`   ✓ Super admin: ${superAdmin.email}`);

  // ── Admin ─────────────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: "admin@ktcouriers.local" },
    update: {},
    create: {
      email: "admin@ktcouriers.local",
      passwordHash,
      name: "KT Admin",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      adminProfile: {
        create: {
          displayName: "KT Admin",
          jobTitle: "Operations Administrator",
        },
      },
    },
  });

  console.log(`   ✓ Admin: ${admin.email}`);

  // ── Phase 2: Employee/Admin Permissions ─────────────────────────────────

  const permissionIdsByKey = new Map<string, string>();
  for (const definition of SYSTEM_PERMISSION_DEFINITIONS) {
    const permission = await prisma.permission.upsert({
      where: { key: definition.key },
      update: {
        name: definition.name,
        category: definition.category,
        description: definition.description,
        isSystem: true,
      },
      create: {
        key: definition.key,
        name: definition.name,
        category: definition.category,
        description: definition.description,
        isSystem: true,
      },
    });
    permissionIdsByKey.set(definition.key, permission.id);
  }

  for (const permissionKey of DEFAULT_ADMIN_PERMISSION_KEYS) {
    const permissionId = permissionIdsByKey.get(permissionKey);
    if (!permissionId) continue;

    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: UserRole.ADMIN,
          permissionId,
        },
      },
      update: { enabled: true },
      create: {
        role: UserRole.ADMIN,
        permissionId,
        enabled: true,
      },
    });
  }

  for (const permissionKey of DEFAULT_STORE_CATALOG_PERMISSION_KEYS) {
    const permissionId = permissionIdsByKey.get(permissionKey);
    if (!permissionId) continue;

    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: UserRole.STORE,
          permissionId,
        },
      },
      update: { enabled: true },
      create: {
        role: UserRole.STORE,
        permissionId,
        enabled: true,
      },
    });
  }

  console.log(
    `   ✓ ${SYSTEM_PERMISSION_DEFINITIONS.length} system permissions synced; ${DEFAULT_ADMIN_PERMISSION_KEYS.length} default admin and ${DEFAULT_STORE_CATALOG_PERMISSION_KEYS.length} store catalog grants seeded`
  );

  await syncSystemPermissions({ actorUserId: superAdmin.id });
  console.log("   ✓ Synced all system permissions and default role permissions across all roles");

  console.log("   ✓ Phase 18/19 permission definitions registered; no storefront projections, collections, synonyms, telemetry, public catalog evidence or ranking evidence seeded");

  if (
    FOUNDATION_STORE_EARNING_ACCOUNT.purpose !== "STORE_EARNINGS_PAYABLE" ||
    FOUNDATION_STORE_EARNING_ACCOUNT.category !== "LIABILITY" ||
    FOUNDATION_STORE_EARNING_ACCOUNT.currency !== "ZAR" ||
    FOUNDATION_STORE_EARNING_ACCOUNT.allowNegative ||
    FOUNDATION_STORE_EARNING_ACCOUNT.openingBalance !== "0.00" ||
    FOUNDATION_STORE_EARNING_JOURNAL_TYPES.length !== 3
  ) {
    throw new Error("Phase 16 store earning account or journal seed policy is invalid.");
  }
  console.log("   ✓ Phase 16 permissions and zero-opening account/journal definitions registered; no store earning financial evidence seeded");

  if (
    FOUNDATION_DRIVER_EARNING_ACCOUNT.purpose !== "DRIVER_EARNINGS_PAYABLE" ||
    FOUNDATION_DRIVER_EARNING_ACCOUNT.category !== "LIABILITY" ||
    FOUNDATION_DRIVER_EARNING_ACCOUNT.currency !== "ZAR" ||
    FOUNDATION_DRIVER_EARNING_ACCOUNT.allowNegative ||
    FOUNDATION_DRIVER_EARNING_ACCOUNT.openingBalance !== "0.00" ||
    FOUNDATION_DRIVER_EARNING_JOURNAL_TYPES.length !== 3
  ) {
    throw new Error("Phase 17 driver earning account or journal seed policy is invalid.");
  }
  console.log("   ✓ Phase 17 permissions and zero-opening account/journal definitions registered; no driver earning financial evidence seeded");

  // ── Delivery Regions ──────────────────────────────────────────────────────
  // DEVELOPMENT ONLY — coordinates and names are example values for local testing.
  // Do not claim these as production coverage areas.

  const regions = [
    // Generic placeholder regions
    {
      name: "City Centre",
      slug: "city-centre",
      description: "Central business district and immediate surrounding areas.",
      city: null,
      province: null,
      centerLat: null,
      centerLng: null,
      coverageRadiusKm: null,
    },
    {
      name: "Northern Suburbs",
      slug: "northern-suburbs",
      description: "Northern residential and commercial suburbs.",
      city: null,
      province: null,
      centerLat: null,
      centerLng: null,
      coverageRadiusKm: null,
    },
    {
      name: "Southern Suburbs",
      slug: "southern-suburbs",
      description: "Southern residential and commercial suburbs.",
      city: null,
      province: null,
      centerLat: null,
      centerLng: null,
      coverageRadiusKm: null,
    },
    // Geographic example regions for dev route matching tests
    {
      name: "Cape Town Metro",
      slug: "cape-town-metro",
      description: "Cape Town metropolitan area — development example only.",
      city: "Cape Town",
      province: "Western Cape",
      centerLat: -33.9249,
      centerLng: 18.4241,
      coverageRadiusKm: 25,
      displayOrder: 10,
    },
    {
      name: "Johannesburg Metro",
      slug: "johannesburg-metro",
      description: "Johannesburg metropolitan area — development example only.",
      city: "Johannesburg",
      province: "Gauteng",
      centerLat: -26.2041,
      centerLng: 28.0473,
      coverageRadiusKm: 30,
      displayOrder: 20,
    },
  ];

  for (const region of regions) {
    await prisma.deliveryRegion.upsert({
      where: { slug: region.slug },
      update: {},
      create: region,
    });
  }

  console.log(`   ✓ ${regions.length} delivery regions seeded (includes dev geographic examples)`);

  // ── Pricing Rules ─────────────────────────────────────────────────────────

  const pricingRules = [
    {
      name: "Base Same-Day Delivery",
      type: "FLAT" as const,
      deliveryType: DeliveryType.SAME_DAY,
      amount: 75.0,
      baseFee: 75.0,
      perKmRate: 0,
      currency: "ZAR",
      description: "Flat rate for same-day delivery within city centre.",
    },
    {
      name: "Scheduled Delivery",
      type: "FLAT" as const,
      deliveryType: DeliveryType.SCHEDULED,
      amount: 60.0,
      baseFee: 60.0,
      perKmRate: 0,
      currency: "ZAR",
      description: "Flat rate for scheduled delivery within service area.",
    },
    {
      name: "Business Account Delivery",
      type: "FLAT" as const,
      deliveryType: DeliveryType.BUSINESS,
      amount: 55.0,
      baseFee: 55.0,
      perKmRate: 0,
      currency: "ZAR",
      description: "Discounted flat rate for verified business accounts.",
    },
    {
      name: "Parcel / Document Delivery",
      type: "PARCEL_SIZE" as const,
      deliveryType: DeliveryType.PARCEL_DOCUMENT,
      amount: 50.0,
      baseFee: 50.0,
      perKmRate: 0,
      currency: "ZAR",
      description: "Flat rate for small parcels and document envelopes.",
    },
  ];

  for (const rule of pricingRules) {
    const existing = await prisma.pricingRule.findFirst({
      where: { name: rule.name },
    });
    if (!existing) await prisma.pricingRule.create({ data: rule });
    else await prisma.pricingRule.update({ where: { id: existing.id }, data: { baseFee: rule.baseFee, perKmRate: rule.perKmRate } });
  }

  console.log(`   ✓ ${pricingRules.length} pricing rules seeded`);

  // ── System Settings ───────────────────────────────────────────────────────

  const settings = [
    {
      key: "platform.name",
      label: "Platform Name",
      type: SystemSettingType.STRING,
      value: "KT Couriers",
      description: "Public display name of the platform.",
    },
    {
      key: "platform.contact_email",
      label: "Contact Email",
      type: SystemSettingType.STRING,
      value: "info@ktcouriers.com",
      description: "Primary contact email shown on public pages.",
    },
    {
      key: "platform.operating_hours",
      label: "Operating Hours",
      type: SystemSettingType.STRING,
      value: "Monday–Friday 08:00–18:00, Saturday 09:00–14:00",
      description: "Human-readable operating hours shown in contact information.",
    },
    {
      key: "orders.require_confirmation",
      label: "Require Order Confirmation",
      type: SystemSettingType.BOOLEAN,
      value: true,
      description: "When enabled, new orders start in PENDING and require admin confirmation before CONFIRMED.",
    },
    {
      key: "orders.default_currency",
      label: "Default Currency",
      type: SystemSettingType.STRING,
      value: "ZAR",
      description: "ISO 4217 currency code for all pricing.",
    },
    { key: "pricing.vat.enabled", label: "Pricing VAT enabled", type: SystemSettingType.BOOLEAN, value: false, description: "Enable only after business and legal confirmation of VAT registration." },
    { key: "pricing.vat.rate", label: "Pricing VAT rate", type: SystemSettingType.STRING, value: "0.1500", description: "Applied to VAT-exclusive pricing only when VAT is enabled." },
    { key: "pricing.quote_ttl_minutes", label: "Pricing quote TTL", type: SystemSettingType.STRING, value: "15", description: "Minutes a server-authoritative delivery quote remains active." },
    { key: "dispatch.assignment_offer_ttl_minutes", label: "Dispatch offer TTL", type: SystemSettingType.STRING, value: "10", description: "Minutes an offered driver assignment remains valid." },
    { key: "dispatch.policy_version", label: "Dispatch policy version", type: SystemSettingType.STRING, value: "dispatch-v1", description: "Recorded with each dispatch eligibility snapshot." },
    { key: "dispatch.default_driver_capacity", label: "Default driver capacity", type: SystemSettingType.STRING, value: "1", description: "Maximum concurrent offered or accepted assignments." },
    { key: "dispatch.serializable_retry_count", label: "Dispatch transaction retries", type: SystemSettingType.STRING, value: "3", description: "Bounded retries for serialization conflicts." },
    {
      key: "orders.max_parcel_count",
      label: "Maximum Parcel Count Per Order",
      type: SystemSettingType.NUMBER,
      value: 10,
      description: "Maximum number of parcels allowed in a single order.",
    },
    {
      key: "notifications.email_enabled",
      label: "Email Notifications Enabled",
      type: SystemSettingType.BOOLEAN,
      value: false,
      description: "Master switch for all outbound email notifications. Disable in development.",
    },
    {
      key: "coverage.confirmation_required",
      label: "Coverage Confirmation Required",
      type: SystemSettingType.BOOLEAN,
      value: true,
      description: "When enabled, customers must confirm their area is covered before submitting.",
    },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log(`   ✓ ${settings.length} system settings seeded`);

  // Phase 22 intentionally seeds permissions only. Commercial membership plans,
  // prices, contracts, billing cycles and entitlements require reviewed admin
  // creation and must never be fabricated by a seed.

  for (const placement of FOUNDATION_AD_PLACEMENTS) {
    await prisma.adPlacement.upsert({
      where: { type: placement.type },
      update: {
        name: placement.name,
        description: placement.description,
        basePrice: placement.basePrice,
        currency: placement.currency,
        isActive: true,
      },
      create: {
        type: placement.type,
        name: placement.name,
        description: placement.description,
        basePrice: placement.basePrice,
        currency: placement.currency,
        isActive: true,
      },
    });
  }

  console.log(`   ✓ ${FOUNDATION_AD_PLACEMENTS.length} foundation ad placements synced`);

  const platformWallet = await prisma.wallet.upsert({
    where: {
      ownerType_ownerId_currency: {
        ownerType: FOUNDATION_PLATFORM_WALLET.ownerType,
        ownerId: FOUNDATION_PLATFORM_WALLET.ownerId,
        currency: FOUNDATION_PLATFORM_WALLET.currency,
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      ownerType: FOUNDATION_PLATFORM_WALLET.ownerType,
      ownerId: FOUNDATION_PLATFORM_WALLET.ownerId,
      currency: FOUNDATION_PLATFORM_WALLET.currency,
      status: "ACTIVE",
    },
  });

  console.log("   ✓ Foundation platform wallet synced");

  for (const definition of FOUNDATION_PLATFORM_LEDGER_ACCOUNTS) {
    const account = await prisma.ledgerAccount.upsert({
      where: { code: definition.code },
      update: {},
      create: {
        walletId: platformWallet.id,
        code: definition.code,
        purpose: LedgerAccountPurpose[definition.purpose],
        category: definition.category,
        currency: definition.currency,
        allowNegative: definition.allowNegative,
      },
    });

    if (
      account.walletId !== platformWallet.id ||
      account.purpose !== definition.purpose ||
      account.category !== definition.category ||
      account.currency !== definition.currency ||
      account.allowNegative !== definition.allowNegative
    ) {
      throw new Error(`Foundation ledger account ${definition.code} conflicts with the canonical definition.`);
    }

    if (
      !account.currentBalance.isZero() ||
      !account.debitTotal.isZero() ||
      !account.creditTotal.isZero()
    ) {
      const entryCount = await prisma.ledgerEntry.count({ where: { accountId: account.id } });
      if (entryCount === 0) {
        throw new Error(`Foundation ledger account ${definition.code} has a non-zero projection without ledger evidence.`);
      }
    }
  }

  console.log(`   ✓ ${FOUNDATION_PLATFORM_LEDGER_ACCOUNTS.length} zero-balance platform ledger accounts verified`);

  // Phase 13: policies are intentionally disabled until a later reviewed activation.
  // No owner earnings, payout destinations, withdrawals, attempts, journals, or balances are seeded.
  for (const ownerType of ["STORE", "DRIVER", "PROMOTER"] as const) {
    await prisma.withdrawalPolicy.upsert({
      where: { ownerType_currency: { ownerType, currency: "ZAR" } },
      update: { enabled: false, requiresReview: true, requiresDualControl: true },
      create: { ownerType, currency: "ZAR", enabled: false, requiresReview: true, requiresDualControl: true },
    });
  }
  console.log("   ✓ Phase 13 withdrawal policies synced as disabled with no financial evidence");

  // ── Demo Drivers ──────────────────────────────────────────────────────────
  // DEVELOPMENT ONLY — demo credentials are unsafe for production environments.

  const ctRegion = await prisma.deliveryRegion.findUnique({ where: { slug: "cape-town-metro" } });
  const jhbRegion = await prisma.deliveryRegion.findUnique({ where: { slug: "johannesburg-metro" } });

  const driversData = [
    {
      email: "driver1@ktcouriers.local",
      name: "Sipho CapeTown",
      driverCode: "DRV-1001",
      phone: "+27 82 000 0001",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.AVAILABLE,
      onboardingStatus: DriverOnboardingStatus.APPROVED,
      vehicleType: VehicleType.MOTORBIKE,
      vehicleRegistration: "CA 123-456",
      regionId: ctRegion?.id,
    },
    {
      email: "driver2@ktcouriers.local",
      name: "Jabu JoBurg",
      driverCode: "DRV-1002",
      phone: "+27 82 000 0002",
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.OFFLINE,
      onboardingStatus: DriverOnboardingStatus.APPROVED,
      vehicleType: VehicleType.CAR,
      vehicleRegistration: "GP 789-101",
      regionId: jhbRegion?.id,
    },
    {
      email: "driver3@ktcouriers.local",
      name: "Thabo Pending",
      driverCode: "DRV-1003",
      phone: "+27 82 000 0003",
      status: DriverStatus.PENDING_REVIEW,
      availability: DriverAvailability.OFFLINE,
      onboardingStatus: DriverOnboardingStatus.PENDING_REVIEW,
      vehicleType: VehicleType.VAN,
      vehicleRegistration: "GP 456-789",
      regionId: null,
    },
  ];

  for (const drv of driversData) {
    const user = await prisma.user.upsert({
      where: { email: drv.email },
      update: {},
      create: {
        email: drv.email,
        passwordHash,
        name: drv.name,
        phone: drv.phone,
        role: UserRole.DRIVER,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    const profile = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {
        maxConcurrentAssignments: drv.driverCode === "DRV-1001" ? 2 : 1,
      },
      create: {
        userId: user.id,
        driverCode: drv.driverCode,
        displayName: drv.name,
        phone: drv.phone,
        active: drv.status === DriverStatus.ACTIVE,
        status: drv.status,
        availability: drv.availability,
        onboardingStatus: drv.onboardingStatus,
        vehicleType: drv.vehicleType,
        vehicleRegistration: drv.vehicleRegistration,
        maxConcurrentAssignments: drv.driverCode === "DRV-1001" ? 2 : 1,
      },
    });

    if (drv.regionId) {
      await prisma.driverServiceRegion.upsert({
        where: {
          driverProfileId_deliveryRegionId: {
            driverProfileId: profile.id,
            deliveryRegionId: drv.regionId,
          },
        },
        update: {},
        create: {
          driverProfileId: profile.id,
          deliveryRegionId: drv.regionId,
          isPrimary: true,
        },
      });
    }
  }

  console.log(`   ✓ ${driversData.length} demo driver accounts seeded`);

  // ── Demo Customer & Profiles ─────────────────────────────────────────────

  const customer = await prisma.user.upsert({
    where: { email: "customer@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    create: {
      email: "customer@ktcouriers.local",
      passwordHash,
      name: "Demo Customer",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.customerProfile.upsert({
    where: { userId: customer.id },
    update: {},
    create: {
      userId: customer.id,
      displayName: "Demo Customer",
      defaultPhone: "+27 82 000 0001",
    },
  });

  console.log(`   ✓ Customer: ${customer.email}`);

  // ── Demo Store Owner & Store ──────────────────────────────────────────────

  const storeOwner = await prisma.user.upsert({
    where: { email: "store@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    create: {
      email: "store@ktcouriers.local",
      passwordHash,
      name: "Demo Store Owner",
      role: UserRole.STORE,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.storeProfile.upsert({
    where: { userId: storeOwner.id },
    update: { status: "ACTIVE" },
    create: {
      userId: storeOwner.id,
      storeName: "KT Express Store",
      contactPerson: "Store Owner",
      businessPhone: "+27 11 000 0002",
      businessEmail: "store@ktcouriers.local",
      status: "ACTIVE",
    },
  });

  const demoStore = await prisma.store.upsert({
    where: { slug: "kt-express-store" },
    update: { ownerUserId: storeOwner.id, status: "ACTIVE" },
    create: {
      name: "KT Express Store",
      slug: "kt-express-store",
      status: "ACTIVE",
      ownerUserId: storeOwner.id,
      contactName: "Store Owner",
      contactEmail: "store@ktcouriers.local",
      contactPhone: "+27 11 000 0002",
      featured: true,
    },
  });

  console.log(`   ✓ Store owner: ${storeOwner.email} (Store: ${demoStore.name})`);

  // ── Demo Promoter ─────────────────────────────────────────────────────────

  const promoterUser = await prisma.user.upsert({
    where: { email: "promoter@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    create: {
      email: "promoter@ktcouriers.local",
      passwordHash,
      name: "Demo Promoter",
      role: UserRole.PROMOTER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.promoterProfile.upsert({
    where: { userId: promoterUser.id },
    update: { status: "ACTIVE" },
    create: {
      userId: promoterUser.id,
      promoterCode: "PROMO-1001",
      displayName: "Demo Promoter",
      phone: "+27 82 000 0005",
      status: "ACTIVE",
    },
  });

  await prisma.promoterAccount.upsert({
    where: { userId: promoterUser.id },
    update: { status: "ACTIVE" },
    create: {
      publicReference: "PROMO-ACC-1001",
      userId: promoterUser.id,
      legalName: "Demo Promoter Legal",
      displayName: "Demo Promoter",
      status: "ACTIVE",
      identityStatus: "VERIFIED",
      taxProfileStatus: "READY",
      payoutReadinessStatus: "READY",
      agreementStatus: "ACCEPTED",
      activatedAt: new Date(),
      approvedAt: new Date(),
    },
  });

  console.log(`   ✓ Promoter: ${promoterUser.email}`);

  // ── Demo Recruitment Applicant ───────────────────────────────────────────

  const applicantUser = await prisma.user.upsert({
    where: { email: "applicant@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    create: {
      email: "applicant@ktcouriers.local",
      passwordHash,
      name: "Jane Candidate",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.recruitmentApplicantProfile.upsert({
    where: { userId: applicantUser.id },
    update: { profileStatus: "ACTIVE" },
    create: {
      publicReference: "APP-REF-1001",
      userId: applicantUser.id,
      legalName: "Jane Candidate",
      preferredName: "Jane",
      primaryEmailReference: "applicant@ktcouriers.local",
      primaryPhoneReference: "+27 82 000 0006",
      city: "Cape Town",
      province: "Western Cape",
      workAuthorizationStatus: "CITIZEN",
      ageEligibilityStatus: "VERIFIED_ADULT",
      profileStatus: "ACTIVE",
    },
  });

  console.log(`   ✓ Applicant: ${applicantUser.email}`);

  // ── Demo Developer / Integration Owner ───────────────────────────────────

  const developerUser = await prisma.user.upsert({
    where: { email: "developer@ktcouriers.local" },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    create: {
      email: "developer@ktcouriers.local",
      passwordHash,
      name: "Demo Developer",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.customerProfile.upsert({
    where: { userId: developerUser.id },
    update: {},
    create: {
      userId: developerUser.id,
      displayName: "Demo Developer",
      defaultPhone: "+27 82 000 0007",
    },
  });

  const apiClient = await prisma.apiClient.upsert({
    where: { id: "dev-client-1001" },
    update: { status: "ACTIVE" },
    create: {
      id: "dev-client-1001",
      name: "Demo Integration App",
      ownerUserId: developerUser.id,
      status: "ACTIVE",
      description: "Local development integration client",
    },
  });

  await prisma.apiKey.upsert({
    where: { id: "dev-key-1001" },
    update: {},
    create: {
      id: "dev-key-1001",
      apiClientId: apiClient.id,
      name: "Development Key",
      keyPrefix: "kt_dev_",
      keyHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
      scopes: ["read", "write"],
    },
  });

  console.log(`   ✓ Developer: ${developerUser.email}`);

  // ── Assignable Demo Orders ─────────────────────────────────────────────────
  // DEVELOPMENT ONLY — local dev dispatch testing. Not representative of real operations.

  const ordersData = [
    {
      orderNumber: "KT-DEV-001",
      status: OrderStatus.CONFIRMED,
      source: OrderSource.CUSTOMER,
      deliveryType: DeliveryType.SAME_DAY,
      recipientName: "Demo Recipient CT",
      recipientPhone: "+27 21 000 0001",
      parcelDescription: "Small package",
      pickup: {
        type: AddressType.PICKUP,
        line1: "1 Long Street",
        city: "Cape Town",
        province: "Western Cape",
        country: "South Africa",
        formattedAddress: "1 Long Street, Cape Town, 8001",
        latitude: -33.9249,
        longitude: 18.4195,
      },
      dropoff: {
        type: AddressType.DROPOFF,
        line1: "10 Bree Street",
        city: "Cape Town",
        province: "Western Cape",
        country: "South Africa",
        formattedAddress: "10 Bree Street, Cape Town, 8001",
        latitude: -33.9228,
        longitude: 18.4176,
      },
      regionSlug: "cape-town-metro",
      distanceMeters: 2200,
      durationSeconds: 420,
    },
    {
      orderNumber: "KT-DEV-002",
      status: OrderStatus.PICKUP_SCHEDULED,
      source: OrderSource.CUSTOMER,
      deliveryType: DeliveryType.SAME_DAY,
      recipientName: "Demo Recipient JHB",
      recipientPhone: "+27 11 000 0002",
      parcelDescription: "Document envelope",
      pickup: {
        type: AddressType.PICKUP,
        line1: "1 Sandton Drive",
        city: "Johannesburg",
        province: "Gauteng",
        country: "South Africa",
        formattedAddress: "1 Sandton Drive, Sandton, Johannesburg",
        latitude: -26.1076,
        longitude: 28.0567,
      },
      dropoff: {
        type: AddressType.DROPOFF,
        line1: "55 Fox Street",
        city: "Johannesburg",
        province: "Gauteng",
        country: "South Africa",
        formattedAddress: "55 Fox Street, Johannesburg, 2001",
        latitude: -26.2044,
        longitude: 28.0437,
      },
      regionSlug: "johannesburg-metro",
      distanceMeters: 11800,
      durationSeconds: 1620,
    },
    {
      orderNumber: "KT-DEV-003",
      status: OrderStatus.CONFIRMED,
      source: OrderSource.CUSTOMER,
      deliveryType: DeliveryType.PARCEL_DOCUMENT,
      recipientName: "Demo Recipient CT 2",
      recipientPhone: "+27 21 000 0003",
      parcelDescription: "Legal documents",
      pickup: {
        type: AddressType.PICKUP,
        line1: "5 Adderley Street",
        city: "Cape Town",
        province: "Western Cape",
        country: "South Africa",
        formattedAddress: "5 Adderley Street, Cape Town, 8001",
        latitude: -33.9218,
        longitude: 18.4241,
      },
      dropoff: {
        type: AddressType.DROPOFF,
        line1: "20 Victoria Road",
        city: "Cape Town",
        province: "Western Cape",
        country: "South Africa",
        formattedAddress: "20 Victoria Road, Cape Town",
        latitude: -33.9145,
        longitude: 18.4129,
      },
      regionSlug: "cape-town-metro",
      distanceMeters: 3500,
      durationSeconds: 600,
    },
  ];

  for (const orderData of ordersData) {
    const existing = await prisma.order.findUnique({ where: { orderNumber: orderData.orderNumber } });
    if (existing) continue;

    const region = await prisma.deliveryRegion.findUnique({ where: { slug: orderData.regionSlug } });

    const pickupAddr = await prisma.address.create({ data: { ...orderData.pickup, userId: customer.id } });
    const dropoffAddr = await prisma.address.create({ data: { ...orderData.dropoff, userId: customer.id } });

    await prisma.order.create({
      data: {
        orderNumber: orderData.orderNumber,
        status: orderData.status,
        source: orderData.source,
        deliveryType: orderData.deliveryType,
        customerId: customer.id,
        recipientName: orderData.recipientName,
        recipientPhone: orderData.recipientPhone,
        parcelDescription: orderData.parcelDescription,
        parcelCount: 1,
        currency: "ZAR",
        pickupAddressId: pickupAddr.id,
        dropoffAddressId: dropoffAddr.id,
        deliveryRegionId: region?.id ?? null,
        distanceMeters: orderData.distanceMeters,
        durationSeconds: orderData.durationSeconds,
        routeProvider: "seed",
        routeCalculatedAt: new Date(),
      },
    });
  }

  console.log(`   ✓ ${ordersData.length} assignable demo orders seeded (DEVELOPMENT ONLY)`);

  // ── Phase 2.6: Demo accepted assignment ready for pickup ─────────────────────
  // DEVELOPMENT ONLY — illustrates pickup custody workflow.
  // driver1 (DRV-1001) has an ACCEPTED assignment for KT-DEV-002 (PICKUP_SCHEDULED).

  const driver1Profile = await prisma.driverProfile.findFirst({
    where: { driverCode: "DRV-1001" },
  });

  const pickupReadyOrder = await prisma.order.findUnique({
    where: { orderNumber: "KT-DEV-002" },
  });

  const superAdminUser = await prisma.user.findUnique({
    where: { email: "superadmin@ktcouriers.local" },
    select: { id: true },
  });

  if (driver1Profile && pickupReadyOrder && superAdminUser) {
    const existingAssignment = await prisma.orderAssignment.findFirst({
      where: {
        orderId: pickupReadyOrder.id,
        driverProfileId: driver1Profile.id,
        status: OrderAssignmentStatus.ACCEPTED,
      },
    });

    if (!existingAssignment) {
      await prisma.$transaction(async (tx) => {
        const assignment = await tx.orderAssignment.create({
          data: {
            orderId: pickupReadyOrder.id,
            driverProfileId: driver1Profile.id,
            assignedByAdminId: superAdminUser.id,
            status: OrderAssignmentStatus.ACCEPTED,
            assignedAt: new Date(),
            acceptedAt: new Date(),
            activeOrderGuard: pickupReadyOrder.id,
            adminNote: "Demo assignment ready for Phase 2.6 pickup workflow testing.",
          },
        });
        await tx.order.update({
          where: { id: pickupReadyOrder.id },
          data: { currentDriverProfileId: driver1Profile.id },
        });
        await tx.orderAssignmentEvent.createMany({ data: [
          {
            assignmentId: assignment.id,
            orderId: pickupReadyOrder.id,
            driverProfileId: driver1Profile.id,
            actorUserId: superAdminUser.id,
            actorRole: "ADMIN",
            eventType: "ASSIGNMENT_CREATED",
            previousStatus: null,
            newStatus: OrderAssignmentStatus.ASSIGNED,
            note: "Seeded for Phase 2.6 pickup workflow demo.",
          },
          {
            assignmentId: assignment.id,
            orderId: pickupReadyOrder.id,
            driverProfileId: driver1Profile.id,
            actorUserId: driver1Profile.userId,
            actorRole: "DRIVER",
            eventType: "ASSIGNMENT_ACCEPTED",
            previousStatus: OrderAssignmentStatus.ASSIGNED,
            newStatus: OrderAssignmentStatus.ACCEPTED,
            note: null,
          },
        ] });
      });

      console.log("   ✓ Phase 2.6 demo accepted assignment seeded (DRV-1001 → KT-DEV-002)");
    } else {
      console.log("   ℹ Phase 2.6 demo assignment already exists — skipped");
    }
  } else {
    console.log("   ⚠ Phase 2.6 demo assignment skipped — required driver/order/admin not found");
  }

  // ── Phase 2.7: Demo order in PICKED_UP state ready for delivery workflow ──────
  // DEVELOPMENT ONLY — driver1 (DRV-1001) has an ACCEPTED assignment for KT-DEV-007
  // (PICKED_UP). Use to test OTP send, complete, attempted, failed flows.

  const driver1ProfileV2 = await prisma.driverProfile.findFirst({
    where: { driverCode: "DRV-1001" },
  });
  const customerForDelivery = await prisma.user.findUnique({
    where: { email: "customer@ktcouriers.local" },
  });
  const deliveryRegionForDemo = await prisma.deliveryRegion.findFirst({
    where: { active: true },
  });
  const superAdminUserV2 = await prisma.user.findUnique({
    where: { email: "superadmin@ktcouriers.local" },
    select: { id: true },
  });

  if (driver1ProfileV2 && customerForDelivery && superAdminUserV2) {
    const existingDeliveryOrder = await prisma.order.findUnique({
      where: { orderNumber: "KT-DEV-007" },
    });

    if (!existingDeliveryOrder) {
      const [deliveryPickupAddr, deliveryDropoffAddr] = await Promise.all([
        prisma.address.create({
          data: {
            label: "Demo Pickup — Phase 2.7",
            type: AddressType.PICKUP,
            line1: "12 Buitenkant Street",
            city: "Cape Town",
            province: "Western Cape",
            country: "ZA",
            postalCode: "8001",
            formattedAddress: "12 Buitenkant Street, Cape Town, 8001",
            contactName: "KT Warehouse",
            contactPhone: "+27210000001",
          },
        }),
        prisma.address.create({
          data: {
            label: "Demo Dropoff — Phase 2.7",
            type: AddressType.DROPOFF,
            line1: "55 Long Street",
            city: "Cape Town",
            province: "Western Cape",
            country: "ZA",
            postalCode: "8001",
            formattedAddress: "55 Long Street, Cape Town, 8001",
            contactName: "Demo Recipient",
            contactPhone: "+27820000099",
          },
        }),
      ]);

      const deliveryDemoOrder = await prisma.order.create({
        data: {
          orderNumber: "KT-DEV-007",
          status: OrderStatus.PICKED_UP,
          source: OrderSource.CUSTOMER,
          deliveryType: DeliveryType.SAME_DAY,
          customerId: customerForDelivery.id,
          recipientName: "Demo Recipient",
          recipientPhone: "+27820000099",
          parcelDescription: "Phase 2.7 delivery demo parcel",
          parcelCount: 1,
          currency: "ZAR",
          pickupAddressId: deliveryPickupAddr.id,
          dropoffAddressId: deliveryDropoffAddr.id,
          deliveryRegionId: deliveryRegionForDemo?.id ?? null,
          distanceMeters: 3200,
          durationSeconds: 600,
          routeProvider: "seed",
          routeCalculatedAt: new Date(),
        },
      });

      await prisma.orderStatusHistory.createMany({
        data: [
          { orderId: deliveryDemoOrder.id, status: OrderStatus.PENDING, actorUserId: customerForDelivery.id },
          { orderId: deliveryDemoOrder.id, status: OrderStatus.CONFIRMED, actorUserId: superAdminUserV2.id },
          { orderId: deliveryDemoOrder.id, status: OrderStatus.PICKUP_SCHEDULED, actorUserId: superAdminUserV2.id },
          { orderId: deliveryDemoOrder.id, status: OrderStatus.PICKED_UP, note: "Parcel collected by driver.", actorUserId: driver1ProfileV2.userId },
        ],
      });

      await prisma.$transaction(async (tx) => {
        const deliveryAssignment = await tx.orderAssignment.create({
          data: {
            orderId: deliveryDemoOrder.id,
            driverProfileId: driver1ProfileV2.id,
            assignedByAdminId: superAdminUserV2.id,
            status: OrderAssignmentStatus.ACCEPTED,
            assignedAt: new Date(),
            acceptedAt: new Date(),
            activeOrderGuard: deliveryDemoOrder.id,
            adminNote: "Demo assignment for Phase 2.7 delivery workflow testing.",
          },
        });
        await tx.order.update({
          where: { id: deliveryDemoOrder.id },
          data: { currentDriverProfileId: driver1ProfileV2.id },
        });
        await tx.orderAssignmentEvent.createMany({ data: [
          {
            assignmentId: deliveryAssignment.id,
            orderId: deliveryDemoOrder.id,
            driverProfileId: driver1ProfileV2.id,
            actorUserId: superAdminUserV2.id,
            actorRole: "ADMIN",
            eventType: "ASSIGNMENT_CREATED",
            previousStatus: null,
            newStatus: OrderAssignmentStatus.ASSIGNED,
          },
          {
            assignmentId: deliveryAssignment.id,
            orderId: deliveryDemoOrder.id,
            driverProfileId: driver1ProfileV2.id,
            actorUserId: driver1ProfileV2.userId,
            actorRole: "DRIVER",
            eventType: "ASSIGNMENT_ACCEPTED",
            previousStatus: OrderAssignmentStatus.ASSIGNED,
            newStatus: OrderAssignmentStatus.ACCEPTED,
          },
        ] });

        await tx.orderOperationalEvent.createMany({ data: [
          {
            orderId: deliveryDemoOrder.id,
            assignmentId: deliveryAssignment.id,
            driverProfileId: driver1ProfileV2.id,
            actorUserId: driver1ProfileV2.userId,
            actorRole: "DRIVER",
            eventType: "PICKUP_COMPLETED",
            statusBefore: OrderStatus.PICKUP_SCHEDULED,
            statusAfter: OrderStatus.PICKED_UP,
            occurredAt: new Date(),
            publicNote: "Parcel collected in good condition.",
          },
        ] });
      });

      console.log("   ✓ Phase 2.7 demo delivery order seeded (DRV-1001 → KT-DEV-007, PICKED_UP)");
    } else {
      console.log("   ℹ Phase 2.7 demo delivery order already exists — skipped");
    }
  } else {
    console.log("   ⚠ Phase 2.7 demo delivery order skipped — required driver/customer/admin not found");
  }

  console.log("\n✅  Seed complete.");
  console.log("   Development account emails are documented in docs/development-seed.md.");
  console.log("   Phase 2.7:   KT-DEV-007 (PICKED_UP) — delivery workflow demo");
  console.log("   ⚠️  Development credentials must never be used for production.");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
