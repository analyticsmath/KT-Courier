import { createHmac, createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { installSystemPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { catalogPublicReference } from "@/lib/catalog/catalog-normalization";
import { createStoreInventoryLocation } from "@/lib/services/catalog-inventory-location.service";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";
import { publishApprovedCatalogListing } from "@/lib/services/catalog-listing-publication.service";
import { moderateCatalogOffer, moderateCatalogProduct } from "@/lib/services/catalog-moderation.service";
import { PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import { submitStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { createLegalDocumentDraft, publishLegalDocumentVersion } from "@/lib/services/legal-documents.service";
import {
  activateOwnerSelectedCourierTariffs,
  MARKETPLACE_COURIER_TARIFF_POLICY_KEY,
} from "@/lib/marketplace-checkout/courier-tariff-policy";
import { consumeVerifiedPaymentEvents } from "@/lib/payments/verified-payment-event-processor.service";
import { enrollQaAcceptancePrincipal, startQaAcceptanceRun } from "@/lib/qa-acceptance/service";
import { openSecurityPayload } from "@/lib/notifications/security-payload-vault";
import { ensureQaPlatformSandboxAccountsInTx } from "@/lib/qa-acceptance/ledger";
import { runReportBatch } from "@/lib/reporting/report-batch";
import { expireReportArtifacts } from "@/lib/reporting/report-expiry-batch";
import { runMarketplaceSettlementBatch } from "@/lib/marketplace-checkout/settlement-batch.service";
import { initializeMarketplaceOrdersBatch } from "@/lib/marketplace-checkout/lifecycle-batch.service";
import { runEarningLifecycleBatch } from "@/lib/services/earning-lifecycle-batch.service";
import {
  DeliveryType,
  DocumentStatus,
  OrderSource,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  PermissionEffect,
  PrivateMediaOwnerType,
  PrivateMediaPurpose,
  PrivateMediaStatus,
  ProofOfDeliveryMethod,
  UserRole,
  UserStatus,
  VehicleComplianceStatus,
  VehicleDocumentType,
  VehicleType,
} from "@/types/db";
import { login, logout } from "./fixtures/auth";

const REAL_CERT_RUN_URL = "https://github.com/analyticsmath/KT-Courier/actions/runs/45984912077";
const REAL_CERT_SHA = "29480f652095ab6ce6d3ba5094dcffb7a8f30810";
const QA_PAYSTACK_SECRET =
  process.env.PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY ?? "sk_test_e2e_qa_sandbox_local_1234";

function buildPaystackStubServer(expectedPort: number): Promise<Server> {
  const txRecords = new Map<string, { amount: number; email: string }>();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${expectedPort}`);
    if (req.method === "POST" && url.pathname === "/transaction/initialize") {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
            reference: string;
            amount: number;
            email: string;
          };
          txRecords.set(parsed.reference, { amount: parsed.amount, email: parsed.email });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              status: true,
              message: "Authorization URL created",
              data: {
                authorization_url: `https://checkout.paystack.com/qa-e2e-${encodeURIComponent(parsed.reference)}`,
                access_code: `acc_${parsed.reference}`,
                reference: parsed.reference,
              },
            }),
          );
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ status: false, message: "Bad request" }));
        }
      });
      return;
    }

    const verifyMatch = /^\/transaction\/verify\/(.+)$/.exec(url.pathname);
    if (req.method === "GET" && verifyMatch) {
      const reference = decodeURIComponent(verifyMatch[1]!);
      const saved = txRecords.get(reference);
      if (!saved) {
        prisma.paymentAttempt
          .findUnique({ where: { merchantReference: reference }, select: { amount: true } })
          .then((attempt) => {
            if (!attempt) {
              res.writeHead(404, { "content-type": "application/json" });
              res.end(JSON.stringify({ status: false, message: "Transaction reference not found." }));
              return;
            }
            const amountCents = Math.round(Number(attempt.amount.toString()) * 100);
            res.writeHead(200, { "content-type": "application/json" });
            res.end(
              JSON.stringify({
                status: true,
                message: "Verification successful",
                data: {
                  id: 991001,
                  domain: "test",
                  status: "success",
                  reference,
                  amount: amountCents,
                  currency: "ZAR",
                  paid_at: new Date().toISOString(),
                },
              }),
            );
          })
          .catch(() => {
            res.writeHead(500);
            res.end();
          });
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          status: true,
          message: "Verification successful",
          data: {
            id: 991002,
            domain: "test",
            status: "success",
            reference,
            amount: saved.amount,
            currency: "ZAR",
            paid_at: new Date().toISOString(),
          },
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(expectedPort, "127.0.0.1", () => resolve(server));
  });
}

test.describe("Operational Browser Acceptance: E01-E07 & Reconciliation Security", () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10).toLowerCase();
  const port = Number(process.env.KT_E2E_PAYSTACK_STUB_PORT ?? "4299");
  let stubServer: Server | null = null;

  const createdUserIds: string[] = [];
  const createdStoreIds: string[] = [];
  const createdAddressIds: string[] = [];
  const createdDriverIds: string[] = [];
  const createdVehicleIds: string[] = [];
  const createdMediaIds: string[] = [];
  const createdRegionIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdParcelIds: string[] = [];
  const createdPolicyIds: string[] = [];
  const createdCommissionPlanIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdProductIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdProductTypeIds: string[] = [];
  const createdCatalogMediaRefs: string[] = [];
  const createdLocationRefs: string[] = [];
  const createdSettingKeys: string[] = [];
  let createdRunId: string | null = null;
  let createdRunRef: string | null = null;
  let createdReconCaseRef: string | null = null;
  let createdCheckoutId: string | null = null;
  let createdMktOrderId: string | null = null;
  const createdReportJobRefs: string[] = [];

  let admin1Email = "";
  let admin2Email = "";
  let readOnlyAdminEmail = "";
  let readOnlyAdminId = "";
  let qaVendorEmail = "";
  let qaCustomerEmail = "";
  let qaDriverEmail = "";
  let commCustomerEmail = "";
  let qaStoreId = "";
  let qaStoreSlug = "";
  let commStoreId = "";
  let qaOfferRef = "";
  let qaProductTitle = "";
  let histOrderId = "";
  let histOrderNumber = "";
  let commHistOrderId = "";
  let qaDriverProfileId = "";
  let qaDriverCode = "";
  let qaCourierPlanRef = "";

  test.beforeAll(async () => {
    stubServer = await buildPaystackStubServer(port);
    await installSystemPermissionDefaults(prisma);
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

    const mkUser = async (tag: string, role: UserRole, isQa = false) => {
      const u = await prisma.user.create({
        data: {
          email: `e2e-qaop-${tag}-${suffix}@ktcouriers.local`,
          name: `E2E ${tag}`,
          role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          passwordHash,
          ...(isQa ? { isQaAcceptance: true } : {}),
        },
      });
      createdUserIds.push(u.id);
      return u;
    };

    const admin1 = await mkUser("admin1", UserRole.SUPER_ADMIN);
    const admin2 = await mkUser("admin2", UserRole.SUPER_ADMIN);
    const roAdmin = await mkUser("roadmin", UserRole.ADMIN);
    const qaVendor = await mkUser("qavendor", UserRole.STORE, true);
    const qaCustomer = await mkUser("qacust", UserRole.CUSTOMER, true);
    const qaDriverUser = await mkUser("qadriver", UserRole.DRIVER, true);
    const commCustomer = await mkUser("commcust", UserRole.CUSTOMER, false);
    const commVendor = await mkUser("commvendor", UserRole.STORE, false);

    admin1Email = admin1.email;
    admin2Email = admin2.email;
    readOnlyAdminEmail = roAdmin.email;
    readOnlyAdminId = roAdmin.id;
    qaVendorEmail = qaVendor.email;
    qaCustomerEmail = qaCustomer.email;
    qaDriverEmail = qaDriverUser.email;
    commCustomerEmail = commCustomer.email;

    // 1. Company profile (for PDF generation)
    const activeCompany = await prisma.companyProfileVersion.findFirst({ where: { status: "ACTIVE" } });
    if (!activeCompany) {
      const latestComp = await prisma.companyProfileVersion.aggregate({ _max: { versionNumber: true } });
      await prisma.companyProfileVersion.create({
        data: {
          publicReference: `CMP-E2E-${suffix}`,
          versionNumber: (latestComp._max.versionNumber ?? 0) + 1,
          status: "ACTIVE",
          legalName: "KT Couriers E2E Holdings (Pty) Ltd",
          tradingName: "KT Couriers",
          registrationNumber: "2026/000001/07",
          supportEmail: "support@ktcouriers.local",
          telephoneNumbers: ["+27110000000"],
          physicalAddress: {
            line1: "100 Commissioner Street",
            city: "Johannesburg",
            country: "South Africa",
          },
          createdByUserId: admin1.id,
          activatedByUserId: admin2.id,
          activatedAt: new Date(Date.now() - 60_000),
          effectiveAt: new Date(Date.now() - 60_000),
        },
      });
    }

    // 2. Legal documents for marketplace checkout
    for (const docType of ["TERMS_OF_SERVICE", "PRIVACY_NOTICE", "REFUND_POLICY"] as const) {
      const existing = await prisma.legalDocumentVersion.findFirst({
        where: { documentType: docType, jurisdiction: "ZA", publicationStatus: "PUBLISHED" },
      });
      if (!existing) {
        const draft = await createLegalDocumentDraft({
          actorUserId: admin1.id,
          documentType: docType,
          version: `e2e-v1-${suffix}`,
          jurisdiction: "ZA",
          content: `KT Couriers E2E ${docType} legal terms content.`,
        });
        await publishLegalDocumentVersion({
          actorUserId: admin2.id,
          publicReference: String(draft.publicReference),
          operationId: randomUUID(),
          effectiveAt: new Date(Date.now() - 60_000),
        });
      }
    }

    // 3. Gauteng Coverage Region, Delivery Services, Parcel Profiles & Operational Policy
    let region = await prisma.deliveryRegion.findFirst({
      where: { active: true, pricingEnabled: true, province: "Gauteng", coverageMode: "RADIUS" },
      orderBy: { displayOrder: "asc" },
    });
    if (!region) {
      region = await prisma.deliveryRegion.create({
        data: {
          name: `QA E2E JHB ${suffix}`,
          slug: `qa-e2e-jhb-${suffix}`,
          city: "Johannesburg",
          province: "Gauteng",
          coverageMode: "RADIUS",
          centerLat: "-26.2041000",
          centerLng: "28.0473000",
          coverageRadiusKm: "45.00",
          maxDistanceKm: "50.00",
          displayOrder: -40,
          active: true,
          pricingEnabled: true,
        },
      });
      createdRegionIds.push(region.id);
    }

    for (const key of ["CLIENT_STANDARD", "CLIENT_ECONOMY"] as const) {
      const existingSvc = await prisma.deliveryServiceDefinition.findFirst({
        where: { stableKey: key, status: "ACTIVE" },
      });
      if (!existingSvc) {
        const latest = await prisma.deliveryServiceDefinition.findFirst({
          where: { stableKey: key },
          orderBy: { versionNumber: "desc" },
        });
        const svc = await prisma.deliveryServiceDefinition.create({
          data: {
            stableKey: key,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            displayName: key === "CLIENT_ECONOMY" ? "Economy" : "Standard",
            status: "ACTIVE",
            effectiveFrom: new Date(Date.now() - 60_000),
            createdByUserId: admin1.id,
            pricingPolicy: {
              stableKey: key,
              displayName: key === "CLIENT_ECONOMY" ? "Economy" : "Standard",
              active: true,
              turnaround: "1-2 business days",
              provinces: ["Gauteng"],
              regionIds: [],
              tariffs: {
                SMALL: { baseFee: "89.00", perKmRate: "0.00", maximumWeightKg: 5, minimumCharge: null },
                MEDIUM: { baseFee: "149.00", perKmRate: "0.00", maximumWeightKg: 15, minimumCharge: null },
                LARGE: { baseFee: "219.00", perKmRate: "0.00", maximumWeightKg: 30, minimumCharge: null },
              },
              expectedVersion: latest?.versionNumber ?? 0,
              reason: "QA E2E courier service",
            },
            coveragePolicy: { provinces: ["Gauteng"], regionIds: [] },
            slaMetadata: { turnaround: "1-2 business days" },
          },
        });
        createdServiceIds.push(svc.id);
      }
    }

    const existingTariffPolicy = await prisma.systemSetting.findUnique({
      where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY },
    });
    if (!existingTariffPolicy) {
      await activateOwnerSelectedCourierTariffs(admin1.id);
      createdSettingKeys.push(MARKETPLACE_COURIER_TARIFF_POLICY_KEY);
    }

    for (const spec of [
      { stableKey: "SMALL", displayName: "Small", lengthCm: 30, widthCm: 20, heightCm: 10, maximumWeightKg: 5 },
      { stableKey: "MEDIUM", displayName: "Medium", lengthCm: 50, widthCm: 35, heightCm: 25, maximumWeightKg: 15 },
      { stableKey: "LARGE", displayName: "Large", lengthCm: 80, widthCm: 60, heightCm: 45, maximumWeightKg: 30 },
    ] as const) {
      const existingParcel = await prisma.parcelProfileVersion.findFirst({
        where: { stableKey: spec.stableKey, status: "ACTIVE" },
      });
      if (!existingParcel) {
        const latestParcel = await prisma.parcelProfileVersion.findFirst({
          where: { stableKey: spec.stableKey },
          orderBy: { versionNumber: "desc" },
        });
        const parcel = await prisma.parcelProfileVersion.create({
          data: {
            stableKey: spec.stableKey,
            displayName: spec.displayName,
            versionNumber: (latestParcel?.versionNumber ?? 0) + 1,
            status: "ACTIVE",
            lengthCm: spec.lengthCm,
            widthCm: spec.widthCm,
            heightCm: spec.heightCm,
            maximumWeightKg: spec.maximumWeightKg,
            effectiveFrom: new Date(Date.now() - 60_000),
            createdByUserId: admin1.id,
          },
        });
        createdParcelIds.push(parcel.id);
      }
    }

    const existingOpPolicy = await prisma.storeOrderOperationalPolicy.findFirst({ where: { status: "ACTIVE" } });
    if (!existingOpPolicy) {
      const opPolicy = await prisma.storeOrderOperationalPolicy.create({
        data: {
          publicReference: `SOP-QA-E2E-${suffix}`,
          name: `qa-e2e-op-policy-${suffix}`,
          versionNumber: 1,
          status: "ACTIVE",
          acceptanceWindowSeconds: 900,
          customerDecisionWindowSeconds: 900,
          maximumPrepMinutes: 60,
          maximumPrepExtensionMinutes: 30,
          maximumIssueCount: 3,
          maximumSubstitutionProposalsPerLine: 2,
          effectiveFrom: new Date(Date.now() - 60_000),
          approvedByUserId: admin2.id,
          activatedAt: new Date(),
        },
      });
      createdPolicyIds.push(opPolicy.id);
    }

    // 4. QA Store (NO operatingHours yet!) + Commercial Parcel-Only Store
    const qaStore = await prisma.store.create({
      data: {
        ownerUserId: qaVendor.id,
        name: `QA Kaventra E2E ${suffix}`,
        slug: `qa-kaventra-e2e-${suffix}`,
        status: "ACTIVE",
        isQaAcceptance: true,
        contactName: "QA Vendor Owner",
        contactEmail: qaVendor.email,
        contactPhone: "+27820001111",
        addressLine1: "45 Commissioner Street",
        addressLine2: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
      },
    });
    qaStoreId = qaStore.id;
    qaStoreSlug = qaStore.slug;
    createdStoreIds.push(qaStore.id);

    const qaPickup = await prisma.address.create({
      data: {
        storeId: qaStore.id,
        type: "PICKUP",
        isDefault: true,
        label: "QA Store Pickup",
        line1: "45 Commissioner Street",
        line2: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        country: "South Africa",
        latitude: "-26.2041000",
        longitude: "28.0473000",
      },
    });
    createdAddressIds.push(qaPickup.id);
    await prisma.store.update({ where: { id: qaStore.id }, data: { defaultPickupAddressId: qaPickup.id } });

    await prisma.storeSellerLegalIdentity.create({
      data: {
        storeId: qaStore.id,
        publicReference: `SID-QA-E2E-${suffix}`,
        identityVersion: "QA_VENDOR_V1",
        legalName: "QA Kaventra Sole Proprietor",
        tradingName: "QA Kaventra",
        vatRegistrationStatus: "NOT_REGISTERED",
        invoiceClassification: "RECEIPT",
        status: "APPROVED",
        effectiveFrom: new Date(Date.now() - 60_000),
      },
    });

    const commStore = await prisma.store.create({
      data: {
        ownerUserId: commVendor.id,
        name: `Commercial Parcel Only ${suffix}`,
        slug: `comm-parcel-only-${suffix}`,
        status: "ACTIVE",
        isQaAcceptance: false,
        contactEmail: commVendor.email,
      },
    });
    commStoreId = commStore.id;
    createdStoreIds.push(commStore.id);

    // 5. Commission Plans: Store plan + QA:COURIER_ORDER plan
    const storePlan = await prisma.commissionPlan.create({
      data: {
        publicReference: `CPL-QA-STORE-${suffix}`,
        subjectType: "MARKETPLACE_STORE_ORDER",
        scopeKey: `STORE:${qaStore.id}`,
        currency: "ZAR",
        versionNumber: 1,
        status: "ACTIVE",
        basisType: "ORDER_SUBTOTAL",
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId: admin1.id,
        submittedByUserId: admin1.id,
        submittedAt: new Date(),
        approvedByUserId: admin2.id,
        approvedAt: new Date(),
        activatedAt: new Date(),
        calculationVersion: "qa-e2e-v1",
        rules: {
          create: {
            publicReference: `CRU-QAS-${suffix}`,
            ruleCode: "PLATFORM_COMMISSION",
            allocationType: "PLATFORM_COMMISSION_REVENUE",
            beneficiaryType: "PLATFORM",
            calculationMethod: "PERCENTAGE_BPS",
            rateBasisPoints: 800,
            priority: 1,
          },
        },
      },
    });
    createdCommissionPlanIds.push(storePlan.id);

    const existingQaCourierPlan = await prisma.commissionPlan.findFirst({
      where: {
        subjectType: "COURIER_ORDER",
        scopeKey: "QA:COURIER_ORDER",
        currency: "ZAR",
        status: "ACTIVE",
        approvedAt: { not: null },
        approvedByUserId: { not: null },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
      },
      orderBy: { versionNumber: "desc" },
    });
    if (
      existingQaCourierPlan &&
      existingQaCourierPlan.approvedByUserId &&
      existingQaCourierPlan.approvedByUserId !== existingQaCourierPlan.createdByUserId
    ) {
      qaCourierPlanRef = existingQaCourierPlan.publicReference;
    } else {
      const latestQaCourierPlan = await prisma.commissionPlan.findFirst({
        where: { subjectType: "COURIER_ORDER", scopeKey: "QA:COURIER_ORDER", currency: "ZAR" },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      qaCourierPlanRef = `CPL-QA-COURIER-${suffix}`;
      const qaCourierPlan = await prisma.commissionPlan.create({
        data: {
          publicReference: qaCourierPlanRef,
          subjectType: "COURIER_ORDER",
          scopeKey: "QA:COURIER_ORDER",
          currency: "ZAR",
          versionNumber: (latestQaCourierPlan?.versionNumber ?? 0) + 1,
          status: "ACTIVE",
          basisType: "ORDER_TOTAL",
          effectiveFrom: new Date(Date.now() - 60_000),
          createdByUserId: admin1.id,
          submittedByUserId: admin1.id,
          submittedAt: new Date(),
          approvedByUserId: admin2.id,
          approvedAt: new Date(),
          activatedAt: new Date(),
          calculationVersion: "qa-courier-e2e-v1",
          rules: {
            create: {
              publicReference: `CRU-QAC-${suffix}`,
              ruleCode: "QA_COURIER_FEE",
              allocationType: "PLATFORM_COMMISSION_REVENUE",
              beneficiaryType: "PLATFORM",
              calculationMethod: "PERCENTAGE_BPS",
              rateBasisPoints: 1500,
              priority: 1,
            },
          },
        },
      });
      createdCommissionPlanIds.push(qaCourierPlan.id);
    }

    // 6. QA Driver + Compliant Approved Docs + Vehicle
    qaDriverCode = `DRV-QAE2E-${suffix.toUpperCase()}`;
    const driverProfile = await prisma.driverProfile.create({
      data: {
        userId: qaDriverUser.id,
        driverCode: qaDriverCode,
        displayName: "QA Acceptance Driver",
        phone: "+27820002222",
        status: "ACTIVE",
        active: true,
        availability: "AVAILABLE",
        onboardingStatus: "APPROVED",
        vehicleType: VehicleType.CAR,
        maxConcurrentAssignments: 3,
        isQaAcceptance: true,
        approvedAt: new Date(),
        approvedByAdminId: admin1.id,
      },
    });
    qaDriverProfileId = driverProfile.id;
    createdDriverIds.push(driverProfile.id);

    await prisma.driverServiceRegion.create({
      data: {
        driverProfileId: driverProfile.id,
        deliveryRegionId: region.id,
        isPrimary: true,
      },
    });

    const mkMedia = async (
      purpose: PrivateMediaPurpose,
      tagName: string,
      ownerType: PrivateMediaOwnerType = PrivateMediaOwnerType.DRIVER,
      ownerId: string = driverProfile.id,
    ) => {
      const m = await prisma.privateMediaObject.create({
        data: {
          publicReference: `pmo_qae2e_${tagName}_${suffix}`,
          ownerType,
          ownerId,
          purpose,
          status: PrivateMediaStatus.READY,
          storageProvider: "LOCAL_TEST",
          storageKey: `e2e/qa/${tagName}-${suffix}.jpg`,
          originalFileName: `${tagName}.jpg`,
          declaredMimeType: "image/jpeg",
          detectedMimeType: "image/jpeg",
          byteSize: 1024,
          checksum: createHash("sha256").update(`${tagName}-${suffix}`).digest("hex"),
          createdByUserId: qaDriverUser.id,
          reviewedByUserId: admin1.id,
          reviewedAt: new Date(),
        },
      });
      createdMediaIds.push(m.id);
      return m;
    };

    const idMedia = await mkMedia(PrivateMediaPurpose.DRIVER_IDENTITY_DOCUMENT, "id");
    const licMedia = await mkMedia(PrivateMediaPurpose.DRIVER_LICENCE, "lic");
    await prisma.driverDocument.createMany({
      data: [
        {
          driverProfileId: driverProfile.id,
          documentType: "ID_DOCUMENT",
          status: DocumentStatus.APPROVED,
          privateMediaObjectId: idMedia.id,
          expiresAt: new Date(Date.now() + 180 * 86_400_000),
          reviewedByAdminId: admin1.id,
          reviewedAt: new Date(),
        },
        {
          driverProfileId: driverProfile.id,
          documentType: "LICENSE",
          status: DocumentStatus.APPROVED,
          privateMediaObjectId: licMedia.id,
          expiresAt: new Date(Date.now() + 180 * 86_400_000),
          reviewedByAdminId: admin1.id,
          reviewedAt: new Date(),
        },
      ],
    });

    const veh = await prisma.vehicle.create({
      data: {
        publicReference: `VEH-QA-E2E-${suffix}`,
        driverProfileId: driverProfile.id,
        make: "Toyota",
        model: "Corolla",
        year: 2024,
        colour: "White",
        registrationNumber: `QAE2E-${suffix.toUpperCase()}`,
        vehicleType: VehicleType.CAR,
        status: VehicleComplianceStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: admin1.id,
      },
    });
    createdVehicleIds.push(veh.id);

    for (const [purpose, docType, tagName] of [
      [PrivateMediaPurpose.VEHICLE_REGISTRATION, VehicleDocumentType.REGISTRATION, "vreg"],
      [PrivateMediaPurpose.VEHICLE_LICENCE_DISC, VehicleDocumentType.LICENCE_DISC, "vdisc"],
      [PrivateMediaPurpose.VEHICLE_INSURANCE, VehicleDocumentType.INSURANCE, "vins"],
    ] as const) {
      const m = await mkMedia(purpose, tagName, PrivateMediaOwnerType.VEHICLE, veh.id);
      await prisma.vehicleDocument.create({
        data: {
          vehicleId: veh.id,
          documentType: docType,
          status: DocumentStatus.APPROVED,
          privateMediaObjectId: m.id,
          expiresAt: new Date(Date.now() + 180 * 86_400_000),
          reviewedByUserId: admin1.id,
          reviewedAt: new Date(),
        },
      });
    }

    // 7. Enroll QA Principals & Start Active QA Run
    await enrollQaAcceptancePrincipal({
      actorUserId: admin1.id,
      role: "VENDOR",
      userIdentifier: qaVendor.id,
      storeIdentifier: qaStore.id,
      label: `QA E2E Vendor ${suffix}`,
    });
    await enrollQaAcceptancePrincipal({
      actorUserId: admin1.id,
      role: "CUSTOMER",
      userIdentifier: qaCustomer.id,
      label: `QA E2E Customer ${suffix}`,
    });
    await enrollQaAcceptancePrincipal({
      actorUserId: admin1.id,
      role: "DRIVER",
      userIdentifier: qaDriverUser.id,
      label: `QA E2E Driver ${suffix}`,
    });

    const qaRun = await startQaAcceptanceRun({
      actorUserId: admin1.id,
      title: `QA Operational Browser Run ${suffix}`,
      storeId: qaStore.id,
      customerUserId: qaCustomer.id,
      driverProfileId: driverProfile.id,
    });
    createdRunId = qaRun.id;
    createdRunRef = qaRun.publicReference;

    // 8. Published QA Product + Offer WITHOUT Trusted Packaging (so diagnostics starts BLOCKED)
    const category = await prisma.catalogCategory.create({
      data: {
        publicReference: catalogPublicReference("CC"),
        name: `QA E2E Cat ${suffix}`,
        slug: `qa-e2e-cat-${suffix}`,
        path: `/qa-e2e-cat-${suffix}`,
        depth: 0,
        status: "ACTIVE",
        createdByUserId: admin1.id,
        updatedByUserId: admin1.id,
      },
    });
    createdCategoryIds.push(category.id);

    const productType = await prisma.productTypeDefinition.create({
      data: {
        publicReference: catalogPublicReference("PT"),
        code: `QA_E2E_TYPE_${suffix.toUpperCase()}`,
        name: `QA E2E Type ${suffix}`,
        versionNumber: 1,
        status: "ACTIVE",
        attributeSchema: { attributes: [] },
        variantSchema: {},
        complianceSchema: { requirements: [] },
        searchFacetSchema: {},
        createdByUserId: admin1.id,
      },
    });
    createdProductTypeIds.push(productType.id);

    const location = await createStoreInventoryLocation(qaStore.id, qaVendor.id, {
      name: `QA E2E Stockroom ${suffix}`,
      operationId: randomUUID(),
    });
    createdLocationRefs.push(location.publicReference);

    const mediaBuf = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 24, g: 58, b: 102 } },
    })
      .png()
      .toBuffer();
    const assetRef = catalogPublicReference("CMA");
    createdCatalogMediaRefs.push(assetRef);
    const assetHash = createHash("sha256").update(mediaBuf).digest("hex");
    await prisma.catalogMediaAsset.create({
      data: {
        publicReference: assetRef,
        ownerType: "STORE",
        ownerStoreId: qaStore.id,
        purpose: "PRODUCT_IMAGE",
        status: "READY",
        storageProvider: "LOCAL_TEST",
        storageKey: `catalog-media/${assetHash}`,
        declaredMimeType: "image/png",
        mimeType: "image/png",
        declaredByteSize: mediaBuf.byteLength,
        byteSize: mediaBuf.byteLength,
        width: 400,
        height: 400,
        checksum: assetHash,
        storageConfirmedAt: new Date(),
        validatedAt: new Date(),
        privacyInspectionPassed: true,
        createdByUserId: qaVendor.id,
        updatedByUserId: qaVendor.id,
      },
    });

    qaProductTitle = `Space Black QA Item ${suffix}`;
    const draft = await createStoreCatalogListingDraft(qaStore.id, qaVendor.id, {
      operationId: randomUUID(),
      product: {
        scope: "STORE_PRIVATE",
        productTypeDefinitionId: productType.id,
        primaryCategoryId: category.id,
        title: qaProductTitle,
        description: "Published QA offer used to verify diagnostics, synthetic packaging, checkout and fulfilment.",
        condition: "NEW",
        attributeValues: {},
        complianceValues: {},
      },
      variants: [],
      storeSku: `QAE2E-${suffix.toUpperCase()}`,
      price: {
        amount: "149.00",
        currency: "ZAR",
        priceIncludesTax: false,
        effectiveFrom: new Date(Date.now() - 60_000).toISOString(),
      },
      openingStock: 10,
      inventoryLocationPublicReference: location.publicReference,
      packaging: {
        lengthCm: 15,
        widthCm: 10,
        heightCm: 5,
        weightKg: 0.25,
        description: "Compact QA parcel before trusted approval",
      },
      modifiers: [],
      media: [
        {
          assetPublicReference: assetRef,
          altText: "Space Black QA item",
          displayOrder: 0,
          primary: true,
          variantAssociation: "PRODUCT",
        },
      ],
    });
    const createdProd = await prisma.catalogProduct.findUniqueOrThrow({
      where: { publicReference: draft.publicReference },
      select: { id: true },
    });
    createdProductIds.push(createdProd.id);
    qaOfferRef = draft.offers[0]!.publicReference;
    createdSettingKeys.push(`${PACKAGING_PREFIX}${qaOfferRef}`);

    const subProd = await submitStoreCatalogProduct(qaStore.id, draft.publicReference, qaVendor.id, {
      version: draft.version,
      operationId: randomUUID(),
    });
    const appProd = await moderateCatalogProduct(subProd.id, admin1.id, "APPROVE", {
      version: subProd.version,
      operationId: randomUUID(),
      reasonCode: "QA_E2E_PRODUCT_APPROVAL",
    });
    const subOffer = await transitionStoreCatalogOffer(qaStore.id, qaOfferRef, qaVendor.id, "SUBMITTED", {
      version: draft.offers[0]!.version,
      operationId: randomUUID(),
    });
    const appOffer = await moderateCatalogOffer(subOffer.id, admin1.id, "APPROVE", {
      version: subOffer.version,
      operationId: randomUUID(),
      reasonCode: "QA_E2E_OFFER_APPROVAL",
    });
    await publishApprovedCatalogListing(appOffer.id, admin2.id, {
      version: appOffer.version,
      productVersion: appProd.version,
      priceVersionReference: draft.offers[0]!.priceVersions[0]!.publicReference,
      operationId: randomUUID(),
      reasonCode: "QA_E2E_PUBLICATION",
    });

    // 9. Historical Delivered QA Courier Order (completed 24h BEFORE commission plan effectiveFrom)
    const histDrop = await prisma.address.create({
      data: {
        type: "DROPOFF",
        label: "Historical QA Recipient",
        line1: "22 Rivonia Road",
        line2: "Sandton",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        latitude: "-26.1076000",
        longitude: "28.0567000",
      },
    });
    createdAddressIds.push(histDrop.id);

    const histTime = new Date(Date.now() - 24 * 3600_000);
    histOrderNumber = `KT-QAE2E-${suffix.toUpperCase()}`;
    const histQuote = await prisma.pricingQuote.create({
      data: {
        status: "USED",
        ownerType: "CUSTOMER",
        ownerId: qaCustomer.id,
        deliveryType: DeliveryType.PARCEL_DOCUMENT,
        currency: "ZAR",
        calculationVersion: "qa-e2e-v1",
        inputHash: createHash("sha256").update(`qahist-quote-${suffix}`).digest("hex"),
        distanceMeters: 12000,
        rawDistanceKm: "12.0000",
        billableDistanceKm: "12.0000",
        subtotal: "89.00",
        taxRate: "0.0000",
        taxAmount: "0.00",
        total: "89.00",
        inputSnapshot: {},
        ruleSnapshot: {},
        regionSnapshot: {},
        taxSnapshot: {},
        expiresAt: new Date(histTime.getTime() + 3600_000),
        usedAt: histTime,
      },
    });
    const histOrder = await prisma.order.create({
      data: {
        orderNumber: histOrderNumber,
        source: OrderSource.CUSTOMER,
        status: OrderStatus.DELIVERED,
        deliveryType: DeliveryType.PARCEL_DOCUMENT,
        currency: "ZAR",
        customerId: qaCustomer.id,
        pickupAddressId: qaPickup.id,
        dropoffAddressId: histDrop.id,
        pricingQuoteId: histQuote.id,
        recipientName: "QA Recipient",
        recipientEmail: qaCustomer.email,
        recipientPhone: "+27820003333",
        parcelDescription: "Historical delivered QA courier parcel for E04 recovery test",
        priceEstimate: "89.00",
        deliveryRegionId: region.id,
        isQaAcceptance: true,
        qaAcceptanceRunId: qaRun.id,
        createdAt: histTime,
      },
    });
    histOrderId = histOrder.id;
    createdOrderIds.push(histOrder.id);

    const histAssignment = await prisma.orderAssignment.create({
      data: {
        orderId: histOrder.id,
        driverProfileId: driverProfile.id,
        status: "COMPLETED",
        assignedAt: histTime,
        acceptedAt: histTime,
        completedAt: histTime,
        assignedByAdminId: admin1.id,
      },
    });

    await prisma.orderAssignmentEvent.create({
      data: {
        assignmentId: histAssignment.id,
        orderId: histOrder.id,
        driverProfileId: driverProfile.id,
        actorUserId: qaDriverUser.id,
        actorRole: "DRIVER",
        eventType: "ASSIGNMENT_COMPLETED",
        previousStatus: "ACCEPTED",
        newStatus: "COMPLETED",
        createdAt: histTime,
      },
    });

    await prisma.orderOperationalEvent.create({
      data: {
        orderId: histOrder.id,
        assignmentId: histAssignment.id,
        driverProfileId: driverProfile.id,
        actorUserId: qaDriverUser.id,
        actorRole: "DRIVER",
        eventType: "DELIVERY_COMPLETED",
        statusBefore: OrderStatus.IN_TRANSIT,
        statusAfter: OrderStatus.DELIVERED,
        occurredAt: histTime,
        createdAt: histTime,
      },
    });

    await prisma.proofOfDelivery.create({
      data: {
        orderId: histOrder.id,
        assignmentId: histAssignment.id,
        driverProfileId: driverProfile.id,
        method: ProofOfDeliveryMethod.OTP,
        recipientName: "QA Recipient",
        otpVerifiedAt: histTime,
        deliveredAt: histTime,
        createdByUserId: qaDriverUser.id,
        createdByRole: "DRIVER",
      },
    });

    const histPay = await prisma.payment.create({
      data: {
        publicReference: `pay_qahist_${suffix}`,
        userId: qaCustomer.id,
        orderId: histOrder.id,
        provider: PaymentProvider.PAYSTACK,
        subjectType: "COURIER_ORDER",
        purpose: "ORDER",
        status: PaymentStatus.PROCESSING,
        latestAttemptNumber: 1,
        amount: "89.00",
        currency: "ZAR",
        creationIdempotencyKey: `qahist-${suffix}`,
        creationRequestHash: createHash("sha256").update(`qahist-${suffix}`).digest("hex"),
        isQaAcceptance: true,
        qaAcceptanceRunId: qaRun.id,
      },
    });

    const histAttempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: histPay.id,
        publicReference: `pat_qahist_${suffix}`,
        attemptNumber: 1,
        provider: PaymentProvider.PAYSTACK,
        idempotencyKey: `qahist-att-${suffix}`,
        requestHash: createHash("sha256").update(`qahist-att-${suffix}`).digest("hex"),
        merchantReference: `kt_qahist_mer_${suffix}`,
        providerReference: `ref_qahist_${suffix}`,
        status: PaymentAttemptStatus.SUCCEEDED,
        amount: "89.00",
        currency: "ZAR",
        providerEnvironment: "SANDBOX",
        startedAt: histTime,
        providerConfirmedAt: histTime,
        completedAt: histTime,
      },
    });

    const sandboxAccounts = await prisma.$transaction((tx) => ensureQaPlatformSandboxAccountsInTx(tx));

    const histJournal = await prisma.ledgerJournal.create({
      data: {
        reference: `JRN-QAHIST-${suffix.toUpperCase()}`,
        type: "EXTERNAL_PAYMENT_RECEIPT",
        correlationId: histPay.publicReference,
        memo: `QA Historical Payment Receipt (${histOrderNumber})`,
        idempotencyKey: `jrn-qahist-${suffix}`,
        requestHash: createHash("sha256").update(`jrn-qahist-${suffix}`).digest("hex"),
        policyVersion: "qa-e2e-v1",
        currency: "ZAR",
        totalDebits: "89.00",
        totalCredits: "89.00",
        postedAt: histTime,
        entries: {
          create: [
            {
              accountId: sandboxAccounts.cashClearing.id,
              direction: "DEBIT",
              amount: "89.00",
              sequence: 1,
              lineCode: "DR_CASH_CLEARING",
              memo: histPay.publicReference,
            },
            {
              accountId: sandboxAccounts.fundsHeld.id,
              direction: "CREDIT",
              amount: "89.00",
              sequence: 2,
              lineCode: "CR_FUNDS_HELD",
              memo: histPay.publicReference,
            },
          ],
        },
      },
    });
    await prisma.ledgerAccount.update({
      where: { id: sandboxAccounts.cashClearing.id },
      data: { currentBalance: { increment: 89 }, debitTotal: { increment: 89 } },
    });
    await prisma.ledgerAccount.update({
      where: { id: sandboxAccounts.fundsHeld.id },
      data: { currentBalance: { increment: 89 }, creditTotal: { increment: 89 } },
    });
    await prisma.payment.update({
      where: { id: histPay.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        version: { increment: 1 },
        successfulAttemptId: histAttempt.id,
        successLedgerJournalId: histJournal.id,
        providerConfirmedAt: histTime,
        succeededAt: histTime,
        metadata: { verifiedVia: "PAYSTACK_VERIFY_API" },
      },
    });

    const commHistOrder = await prisma.order.create({
      data: {
        orderNumber: `KT-COMM-${suffix.toUpperCase()}`,
        source: OrderSource.CUSTOMER,
        status: OrderStatus.DELIVERED,
        deliveryType: DeliveryType.PARCEL_DOCUMENT,
        currency: "ZAR",
        customerId: commCustomer.id,
        pickupAddressId: qaPickup.id,
        dropoffAddressId: histDrop.id,
        priceEstimate: "95.00",
        isQaAcceptance: false,
      },
    });
    commHistOrderId = commHistOrder.id;
    createdOrderIds.push(commHistOrder.id);

    // 10. Open Paystack Reconciliation Case for /admin/reconciliation RBAC + Stale + Replay tests
    const recOrder = await prisma.order.create({
      data: {
        orderNumber: `KT-QAREC-${suffix.toUpperCase()}`,
        source: OrderSource.CUSTOMER,
        status: OrderStatus.PENDING,
        deliveryType: DeliveryType.PARCEL_DOCUMENT,
        currency: "ZAR",
        customerId: qaCustomer.id,
        pickupAddressId: qaPickup.id,
        dropoffAddressId: histDrop.id,
        recipientName: "QA Recon Recipient",
        recipientEmail: qaCustomer.email,
        recipientPhone: "+27820003344",
        parcelDescription: "QA pending order for reconciliation retry verification",
        priceEstimate: "99.00",
        deliveryRegionId: region.id,
        isQaAcceptance: true,
        qaAcceptanceRunId: qaRun.id,
      },
    });
    createdOrderIds.push(recOrder.id);

    const recPay = await prisma.payment.create({
      data: {
        publicReference: `pay_qarec_${suffix}`,
        userId: qaCustomer.id,
        orderId: recOrder.id,
        provider: PaymentProvider.PAYSTACK,
        subjectType: "COURIER_ORDER",
        purpose: "ORDER",
        status: PaymentStatus.PROVIDER_PENDING,
        reconciliationStatus: "REQUIRED",
        amount: "99.00",
        currency: "ZAR",
        latestAttemptNumber: 1,
        creationIdempotencyKey: `qarec-${suffix}`,
        creationRequestHash: createHash("sha256").update(`qarec-${suffix}`).digest("hex"),
        isQaAcceptance: true,
        qaAcceptanceRunId: qaRun.id,
      },
    });
    const recAttempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: recPay.id,
        publicReference: `pat_qarec_${suffix}`,
        attemptNumber: 1,
        provider: PaymentProvider.PAYSTACK,
        idempotencyKey: `rec-att-${suffix}`,
        requestHash: createHash("sha256").update(`rec-att-${suffix}`).digest("hex"),
        merchantReference: `kt_qarec_mer_${suffix}`,
        status: PaymentAttemptStatus.PROCESSING,
        amount: "99.00",
        currency: "ZAR",
        providerEnvironment: "SANDBOX",
        startedAt: new Date(Date.now() - 40 * 60_000),
      },
    });
    createdReconCaseRef = `prc_qarec_${suffix}`;
    await prisma.paymentReconciliationCase.create({
      data: {
        publicReference: createdReconCaseRef,
        caseKey: `qarec:${recPay.id}:${recAttempt.id}`,
        paymentId: recPay.id,
        attemptId: recAttempt.id,
        provider: PaymentProvider.PAYSTACK,
        reason: "STALE_PROCESSING_ATTEMPT",
        status: "OPEN",
        priority: "HIGH",
        summary: `E2E QA Reconciliation Case ${suffix}`,
        observationCount: 1,
        safeEvidence: { merchantReference: recAttempt.merchantReference },
      },
    });
  });

  test.afterAll(async () => {
    if (stubServer) {
      await new Promise<void>((resolve) => stubServer!.close(() => resolve()));
    }
    const keysToDelete = [
      ...createdSettingKeys,
      "production_acceptance_current_ci_certification",
      ...(histOrderId ? [`qa_settlement_recovery:${histOrderId}`] : []),
    ];
    await prisma.systemSetting.deleteMany({
      where: {
        OR: [
          { key: { in: keysToDelete } },
          { key: { startsWith: "production_qa_functional_" } },
          { key: { startsWith: "production_marketplace_trusted_packages_v" } },
        ],
      },
    }).catch(() => {});

    if (createdReconCaseRef) {
      await prisma.paymentReconciliationCase.deleteMany({ where: { publicReference: createdReconCaseRef } }).catch(() => {});
    }
    if (createdReportJobRefs.length) {
      await prisma.reportAuditEvent.deleteMany({ where: { entityReference: { in: createdReportJobRefs } } }).catch(() => {});
      const rJobs = await prisma.reportJob
        .findMany({ where: { publicReference: { in: createdReportJobRefs } }, select: { id: true } })
        .catch(() => []);
      const rJobIds = rJobs.map((r) => r.id);
      if (rJobIds.length) {
        await prisma.reportReconciliationCase.deleteMany({ where: { jobId: { in: rJobIds } } }).catch(() => {});
        await prisma.reportExportArtifact.deleteMany({ where: { jobId: { in: rJobIds } } }).catch(() => {});
      }
      await prisma.reportJob.deleteMany({ where: { publicReference: { in: createdReportJobRefs } } }).catch(() => {});
    }
    for (const orderId of createdOrderIds) {
      await prisma.driverEarning.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.commissionAccrual.deleteMany({ where: { subjectId: orderId } }).catch(() => {});
      await prisma.orderOperationalEvent.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.proofOfDelivery.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.orderAssignment.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.shipmentDocument.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.shipmentTrackingGrant.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.paymentAttempt.deleteMany({ where: { payment: { orderId } } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    if (createdMktOrderId) {
      await prisma.marketplaceStoreOrderDeliveryBridge.deleteMany({ where: { storeOrder: { marketplaceOrderId: createdMktOrderId } } }).catch(() => {});
      await prisma.marketplaceStoreOrder.deleteMany({ where: { marketplaceOrderId: createdMktOrderId } }).catch(() => {});
      await prisma.marketplaceOrder.deleteMany({ where: { id: createdMktOrderId } }).catch(() => {});
    }
    if (createdCheckoutId) {
      await prisma.marketplaceInventoryReservationItem.deleteMany({ where: { reservation: { checkoutId: createdCheckoutId } } }).catch(() => {});
      await prisma.marketplaceInventoryReservation.deleteMany({ where: { checkoutId: createdCheckoutId } }).catch(() => {});
      await prisma.marketplaceCheckout.deleteMany({ where: { id: createdCheckoutId } }).catch(() => {});
    }
    if (createdUserIds.length) {
      await prisma.qaAcceptancePrincipal.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
    }
    if (createdRunId) {
      await prisma.qaAcceptanceRun.deleteMany({ where: { id: createdRunId } }).catch(() => {});
    }
    for (const prodId of createdProductIds) {
      await prisma.storefrontProductDocument.deleteMany({ where: { productId: prodId } }).catch(() => {});
      const offers = await prisma.storeCatalogOffer.findMany({ where: { productId: prodId }, select: { id: true } }).catch(() => []);
      const offerIds = offers.map((o) => o.id);
      if (offerIds.length) {
        await prisma.catalogModerationHistory.deleteMany({ where: { moderationCase: { offerId: { in: offerIds } } } }).catch(() => {});
        await prisma.catalogModerationCase.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
        await prisma.catalogInventoryMovement.deleteMany({ where: { inventoryItem: { offerId: { in: offerIds } } } }).catch(() => {});
        await prisma.catalogInventoryLevel.deleteMany({ where: { inventoryItem: { offerId: { in: offerIds } } } }).catch(() => {});
        await prisma.catalogInventoryItem.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
        await prisma.storeCatalogOffer.updateMany({ where: { id: { in: offerIds } }, data: { currentPriceVersionId: null, primaryInventoryLocationId: null } }).catch(() => {});
        await prisma.catalogPublicationSnapshot.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
        await prisma.storeOfferPriceVersion.deleteMany({ where: { offerId: { in: offerIds } } }).catch(() => {});
        await prisma.storeCatalogOffer.deleteMany({ where: { id: { in: offerIds } } }).catch(() => {});
      }
      await prisma.catalogPublicationSnapshot.deleteMany({ where: { productId: prodId } }).catch(() => {});
      await prisma.catalogProductMedia.deleteMany({ where: { productId: prodId } }).catch(() => {});
      await prisma.catalogVariantOptionValue.deleteMany({ where: { variant: { productId: prodId } } }).catch(() => {});
      await prisma.catalogProductVariant.deleteMany({ where: { productId: prodId } }).catch(() => {});
      await prisma.catalogProduct.delete({ where: { id: prodId } }).catch(() => {});
    }
    for (const ref of createdCatalogMediaRefs) await prisma.catalogMediaAsset.deleteMany({ where: { publicReference: ref } }).catch(() => {});
    for (const ref of createdLocationRefs) await prisma.inventoryLocation.deleteMany({ where: { publicReference: ref } }).catch(() => {});
    for (const id of createdProductTypeIds) await prisma.productTypeDefinition.delete({ where: { id } }).catch(() => {});
    for (const id of createdCategoryIds) await prisma.catalogCategory.delete({ where: { id } }).catch(() => {});
    for (const id of createdCommissionPlanIds) {
      await prisma.commissionPlanStatusHistory.deleteMany({ where: { planId: id } }).catch(() => {});
      await prisma.commissionRule.deleteMany({ where: { planId: id } }).catch(() => {});
      await prisma.commissionPlan.delete({ where: { id } }).catch(() => {});
    }
    for (const vid of createdVehicleIds) {
      await prisma.vehicleDocument.deleteMany({ where: { vehicleId: vid } }).catch(() => {});
      await prisma.vehicle.delete({ where: { id: vid } }).catch(() => {});
    }
    for (const did of createdDriverIds) {
      await prisma.driverDocument.deleteMany({ where: { driverProfileId: did } }).catch(() => {});
      await prisma.driverServiceRegion.deleteMany({ where: { driverProfileId: did } }).catch(() => {});
      await prisma.driverProfile.delete({ where: { id: did } }).catch(() => {});
    }
    for (const mid of createdMediaIds) await prisma.privateMediaObject.delete({ where: { id: mid } }).catch(() => {});
    for (const sid of createdStoreIds) {
      await prisma.storefrontStoreDocument.deleteMany({ where: { storeId: sid } }).catch(() => {});
      await prisma.storeCheckoutCertification.deleteMany({ where: { storeId: sid } }).catch(() => {});
      await prisma.storeSellerLegalIdentity.deleteMany({ where: { storeId: sid } }).catch(() => {});
      await prisma.store.update({ where: { id: sid }, data: { defaultPickupAddressId: null } }).catch(() => {});
      await prisma.address.deleteMany({ where: { storeId: sid } }).catch(() => {});
      await prisma.store.delete({ where: { id: sid } }).catch(() => {});
    }
    for (const aid of createdAddressIds) await prisma.address.delete({ where: { id: aid } }).catch(() => {});
    for (const pid of createdPolicyIds) await prisma.storeOrderOperationalPolicy.delete({ where: { id: pid } }).catch(() => {});
    for (const pid of createdParcelIds) await prisma.parcelProfileVersion.delete({ where: { id: pid } }).catch(() => {});
    for (const sid of createdServiceIds) await prisma.deliveryServiceDefinition.delete({ where: { id: sid } }).catch(() => {});
    for (const rid of createdRegionIds) await prisma.deliveryRegion.delete({ where: { id: rid } }).catch(() => {});
    for (const uid of createdUserIds) await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    await prisma.$disconnect();
  });

  test("verifies all interactive E01-E07 workflows, negative isolation, RBAC reconciliation, and live GitHub CI acceptance in browser", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // ─── 1. Offer diagnostics initially BLOCKED + Trading hours initially "Not saved" ───
    await login(page, admin1Email);
    await page.goto(`/admin/stores/${qaStoreId}/readiness`);
    await expect(page.getByText("Not saved", { exact: true })).toBeVisible();
    await expect(page.getByText("0 / 1 SELLABLE")).toBeVisible();

    // ─── 2. Vendor saves Trading Hours via UI -> Readiness projects Configured ───
    await login(page, qaVendorEmail);
    await page.goto("/store/profile");
    await page.locator("#sp_collection_note").fill(`Mon-Fri 08:30-16:30 SAST E2E ${suffix}`);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText("Changes saved", { exact: true })).toBeVisible();

    await login(page, admin1Email);
    await page.goto(`/admin/stores/${qaStoreId}/readiness`);
    await expect(page.getByText(/Configured \(/)).toBeVisible();

    // ─── 3. Synthetic Packaging Prep, Negative Commercial Checks, Dual-Control Approve & Activate ───
    await page.goto("/admin/qa-acceptance");
    const offerRow = page.locator("li", { hasText: qaOfferRef });
    await expect(offerRow).toBeVisible();
    await offerRow.getByRole("button", { name: "Record QA Synthetic Pkg", exact: true }).click();
    await expect(page.getByText(`Recorded synthetic QA package draft for ${qaOfferRef}`)).toBeVisible();

    const commPkgAttempt = await page.request.post("/api/admin/qa-acceptance/synthetic-packaging", {
      headers: { origin: new URL(page.url()).origin },
      data: {
        runId: createdRunId,
        storeId: commStoreId,
        offerReference: qaOfferRef,
        lengthCm: 15,
        widthCm: 10,
        heightCm: 5,
        weightKg: 0.25,
        reason: "Negative commercial store isolation probe",
      },
    });
    expect(commPkgAttempt.status()).toBe(409);

    await login(page, admin2Email);
    await page.goto("/admin/qa-acceptance");
    const offerRowAdmin2 = page.locator("li", { hasText: qaOfferRef });
    await offerRowAdmin2.getByRole("button", { name: /Approve v\d+/ }).click();
    await expect(page.getByText(/Approved QA synthetic package v/)).toBeVisible();
    await offerRowAdmin2.getByRole("button", { name: /Activate v\d+/ }).click();
    await expect(page.getByText(/Activated QA synthetic package v/)).toBeVisible();

    await page.goto(`/admin/stores/${qaStoreId}/readiness`);
    await expect(page.getByText("1 / 1 SELLABLE")).toBeVisible();
    await expect(page.getByText("SELLABLE_FOR_CHECKOUT")).toBeVisible();

    // ─── 4. Accessible Checkout Certification (#checkout-certification) Dual-Control ───
    await login(page, admin1Email);
    await page.goto(`/admin/stores/${qaStoreId}#checkout-certification`);
    await expect(page.locator("#checkout-certification")).toBeVisible();
    await page
      .getByRole("button", { name: /Run real-source checkout capability proof & submit for review/i })
      .click();
    await expect(page.getByText(/Dual-control requires a different administrator/i)).toBeVisible();

    await login(page, admin2Email);
    await page.goto(`/admin/stores/${qaStoreId}#checkout-certification`);
    await page.getByRole("button", { name: "Approve independently reviewed staging evidence", exact: true }).click();
    await expect(page.getByText(/Independent certification approved/i)).toBeVisible();

    // ─── 5. Private QA Storefront Visibility & Negative Commercial Isolation ───
    await login(page, commCustomerEmail);
    await page.goto("/shop/qa");
    await expect(page.getByText(/Private QA Acceptance Storefront|QA Demonstration Stores/i)).toHaveCount(0);
    await expect(page.getByText(/That marketplace item is not available|404|not found/i).first()).toBeVisible();
    await page.goto("/shop");
    await expect(page.getByText(qaProductTitle)).toHaveCount(0);

    await login(page, qaCustomerEmail);
    await page.goto("/shop/qa");
    const qaMain = page.locator("main").first();
    await expect(qaMain.getByText(`QA Kaventra E2E ${suffix}`)).toBeVisible();
    await expect(qaMain.getByText("Trading hours configured")).toBeVisible();
    await expect(qaMain.getByText(`Mon-Fri 08:30-16:30 SAST E2E ${suffix}`)).toBeVisible();

    await qaMain.locator(`a[href="/shop/qa/stores/${encodeURIComponent(qaStoreSlug)}"]`).click();
    await expect(page.getByText(qaProductTitle).first()).toBeVisible();
    await page.getByRole("link", { name: new RegExp(qaProductTitle, "i") }).first().click();
    await expect(page.locator('[data-kt-action="add-to-cart"]')).toBeVisible();

    // ─── 6. Real Browser Purchase & Full Store/Driver/QA_SIMULATED Fulfilment ───
    await page.locator('[data-kt-action="add-to-cart"]').click();
    const cartToast = page.getByRole("status").filter({ hasText: /added to your cart\./i });
    await expect(cartToast).toBeVisible();
    await cartToast.getByRole("link", { name: "View cart" }).click();
    await page.getByRole("button", { name: /Proceed to Checkout/ }).click();

    await page.getByLabel("Recipient Full Name", { exact: true }).fill("QA Customer Buyer");
    await page.getByLabel("Email Address", { exact: true }).fill(qaCustomerEmail);
    await page.getByLabel("Phone Number (SA)", { exact: true }).fill("+27820004444");
    await page.getByRole("button", { name: /Continue to Delivery Address/ }).click();

    await page.getByLabel("Street Address (Line 1)", { exact: true }).fill("10 Rivonia Road");
    await page.getByLabel("Suburb / Area", { exact: true }).fill("Sandton");
    await page.getByLabel("City", { exact: true }).fill("Johannesburg");
    await page.getByLabel("Province", { exact: true }).selectOption("Gauteng");
    await page.getByLabel("Postal Code", { exact: true }).fill("2196");
    await page.getByRole("button", { name: /Calculate Delivery/ }).click();
    await expect(page.getByRole("heading", { name: "3. Delivery options", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Review order/ }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Continue to payment/ }).click();

    await page.route("https://checkout.paystack.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body><h1>QA E2E Paystack Redirect Captured</h1></body></html>",
      });
    });

    const prepPayPromise = page.waitForResponse(
      (res) => res.url().includes("/prepare-payment") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /Pay .* with Paystack/ }).click();
    const prepPayRes = await prepPayPromise;
    expect(prepPayRes.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "QA E2E Paystack Redirect Captured" })).toBeVisible();
    const checkoutRefMatch = /\/api\/checkout\/([^/]+)\/prepare-payment/.exec(prepPayRes.url());
    expect(checkoutRefMatch?.[1]).toBeTruthy();

    const checkoutRow = await prisma.marketplaceCheckout.findUniqueOrThrow({
      where: { publicReference: checkoutRefMatch![1] },
      select: { id: true },
    });
    createdCheckoutId = checkoutRow.id;

    const attempt = await prisma.paymentAttempt.findFirstOrThrow({
      where: { payment: { marketplaceCheckoutId: checkoutRow.id } },
      orderBy: { attemptNumber: "desc" },
    });
    const rawWebhook = JSON.stringify({
      event: "charge.success",
      data: {
        id: 991002,
        domain: "test",
        status: "success",
        reference: attempt.merchantReference,
        amount: Math.round(Number(attempt.amount.toString()) * 100),
        currency: "ZAR",
      },
    });
    const webhookRes = await page.request.post("/api/payments/paystack/sandbox-webhook", {
      data: rawWebhook,
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": createHmac("sha512", QA_PAYSTACK_SECRET).update(rawWebhook).digest("hex"),
      },
    });
    expect(webhookRes.status()).toBe(200);
    let mktOrder: {
      id: string;
      storeOrders: Array<{
        id: string;
        publicReference: string;
      }>;
    } | null = null;
    await expect
      .poll(
        async () => {
          await consumeVerifiedPaymentEvents({
            limit: 20,
            subjectTypes: ["MARKETPLACE_CHECKOUT"],
          }).catch(() => {});
          mktOrder = await prisma.marketplaceOrder.findUnique({
            where: { checkoutId: createdCheckoutId! },
            include: { storeOrders: true },
          });
          return Boolean(mktOrder?.storeOrders[0]?.publicReference);
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const finalizedMktOrder = mktOrder!;
    createdMktOrderId = finalizedMktOrder.id;
    const storeOrder = finalizedMktOrder.storeOrders[0]!;
    const storeOrderRef = storeOrder.publicReference;
    const settlementOutcome = await runMarketplaceSettlementBatch({ mode: "APPLY", batchSize: 20 });
    expect(settlementOutcome.itemsCompleted).toBeGreaterThanOrEqual(1);
    const initOutcome = await initializeMarketplaceOrdersBatch({ mode: "APPLY", batchSize: 20 });
    expect(initOutcome.itemsCompleted).toBeGreaterThanOrEqual(1);

    // Vendor prepares store order in UI (Accept order creates deliveryBridge + courierOrderId)
    await login(page, qaVendorEmail);
    await page.goto(`/store/marketplace-orders/${storeOrderRef}`);
    await page.getByRole("button", { name: "Begin review", exact: true }).click();
    await expect(page.getByRole("button", { name: "Begin review", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm availability", exact: true }).click();
    await expect(page.getByText("The store order was updated by the server.")).toBeVisible();
    await page.getByLabel("Preparation time (minutes)").fill("15");
    await page.getByLabel("Pickup instructions").fill("Collect from QA Dispatch Counter");
    await page.getByRole("button", { name: "Accept order", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start preparation", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Start preparation", exact: true }).click();
    await expect(page.getByRole("button", { name: "Mark ready for collection", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark ready for collection", exact: true }).click();
    await expect(page.getByRole("button", { name: "Generate store pickup code", exact: true })).toBeVisible();

    const bridgeRow = await prisma.marketplaceStoreOrderDeliveryBridge.findUniqueOrThrow({
      where: { marketplaceStoreOrderId: storeOrder.id },
      select: { courierOrderId: true },
    });
    const courierOrderId = bridgeRow.courierOrderId!;
    createdOrderIds.push(courierOrderId);

    // Admin dispatches QA order via UI modal
    await login(page, admin1Email);
    await page.goto(`/admin/orders/${courierOrderId}`);
    await page.getByRole("button", { name: "Assign driver", exact: true }).click();
    await page.locator("#assignment-driver").selectOption(qaDriverProfileId);
    await page.getByRole("button", { name: "Confirm assignment", exact: true }).click();
    await expect(page.getByText(qaDriverCode)).toBeVisible();

    const assignmentRow = await prisma.orderAssignment.findFirstOrThrow({
      where: { orderId: courierOrderId, driverProfileId: qaDriverProfileId },
      orderBy: { createdAt: "desc" },
    });

    // Driver accepts assignment first (required before vendor generates pickup code)
    await login(page, qaDriverEmail);
    await page.goto(`/driver/assignments/${assignmentRow.id}`);
    await page.getByRole("button", { name: "Accept Assignment", exact: true }).click();
    await expect(page.getByRole("link", { name: "Verify store pickup", exact: true })).toBeVisible();

    // Vendor generates 6-digit store pickup code once driver assignment is accepted
    await login(page, qaVendorEmail);
    await page.goto(`/store/marketplace-orders/${storeOrderRef}`);
    await page.getByRole("button", { name: "Generate store pickup code", exact: true }).click();
    const pickupBanner = page.getByRole("status").filter({ hasText: "Store pickup code:" });
    await expect(pickupBanner).toBeVisible();
    const pickupCodeMatch = (await pickupBanner.innerText()).match(/Store pickup code:\s*(\d{6})/);
    expect(pickupCodeMatch).not.toBeNull();
    const pickupCode = pickupCodeMatch![1]!;

    // Driver verifies store handoff pickup code, starts delivery, runs QA_SIMULATED location & completes via OTP
    await login(page, qaDriverEmail);
    await page.goto(`/driver/assignments/${assignmentRow.id}`);
    await page.getByRole("link", { name: "Verify store pickup", exact: true }).click();
    await page.getByLabel("Store pickup code", { exact: true }).fill(pickupCode);
    await page.getByRole("checkbox", { name: /I checked and collected/ }).check();
    await page.getByRole("button", { name: "Verify store pickup", exact: true }).click();
    await expect(page.locator("#pickup-feedback")).toContainText("Store handoff verified");

    await page.goto(`/driver/assignments/${assignmentRow.id}`);
    await page.getByRole("button", { name: "Start Delivery", exact: true }).click();
    await page.getByRole("button", { name: "Confirm Start Delivery", exact: true }).click();
    await page.getByRole("button", { name: "Simulate QA Arrival Location", exact: true }).click();
    await expect(page.getByText(/QA simulated location recorded/).first()).toBeVisible();

    await page.getByRole("button", { name: "Confirm safety check", exact: true }).click();
    await expect(page.getByText("Safety check recorded.")).toBeVisible();
    await page.getByRole("button", { name: "Confirm lawful transport", exact: true }).click();
    await expect(page.getByText("Lawful transport confirmation recorded.")).toBeVisible();

    await page.getByRole("button", { name: "Send OTP to Recipient", exact: true }).click();
    await page.getByRole("button", { name: "Send OTP Now", exact: true }).click();
    await expect(page.locator("#otp-code")).toBeVisible();

    const otpIntent = await prisma.notificationEventIntent.findFirstOrThrow({
      where: { aggregateReference: courierOrderId, eventType: "DELIVERY_OTP" },
      orderBy: { createdAt: "desc" },
    });
    const otpSecure = await prisma.notificationSecurePayload.findUniqueOrThrow({
      where: { eventIntentId: otpIntent.id },
    });
    const { otp } = openSecurityPayload(otpSecure.encryptedPayload, otpIntent.operationId) as { otp: string };

    await page.locator("#otp-code").fill(otp);
    await page.locator("#del-recipient-name").fill("QA Customer Buyer");
    await page.locator("#del-driver-note").fill("Delivered with QA_SIMULATED evidence and verified OTP");
    await page.getByRole("checkbox", { name: /I confirm the parcel has been delivered/ }).check();
    await page.getByRole("button", { name: "Confirm Delivery", exact: true }).click();
    await expect(page.getByText(/Order:\s*DELIVERED/i)).toBeVisible();

    const driverEarningBatch = await runEarningLifecycleBatch({ mode: "APPLY", batchSize: 25 });
    expect(driverEarningBatch.itemsCompleted).toBeGreaterThanOrEqual(1);

    // Verify QA inventory decrement and QA-isolated store & driver financial settlement
    const [qaDriverEarn, qaStoreEarn, qaInvMov] = await Promise.all([
      prisma.driverEarning.findFirst({ where: { orderId: courierOrderId } }),
      prisma.storeEarning.findFirst({ where: { subjectId: finalizedMktOrder.storeOrders[0]!.id } }),
      prisma.catalogInventoryMovement.findFirst({
        where: { inventoryItem: { offer: { publicReference: qaOfferRef } }, quantityDelta: { lt: 0 } },
      }),
    ]);
    expect(qaInvMov).not.toBeNull();
    expect(qaDriverEarn?.isQaAcceptance).toBe(true);
    if (qaStoreEarn) {
      expect(qaStoreEarn.isQaAcceptance).toBe(true);
    }

    const waybillRes = await page.request.get(`/api/orders/${courierOrderId}/documents/waybill?disposition=inline`);
    expect(waybillRes.status()).toBe(200);
    expect(waybillRes.headers()["content-type"]).toContain("application/pdf");
    expect((await waybillRes.body()).subarray(0, 5).toString("ascii")).toBe("%PDF-");

    const podRes = await page.request.get(`/api/orders/${courierOrderId}/documents/pod?disposition=inline`);
    expect(podRes.status()).toBe(200);
    expect(podRes.headers()["content-type"]).toContain("application/pdf");
    expect((await podRes.body()).subarray(0, 5).toString("ascii")).toBe("%PDF-");

    // ─── 7. Historical QA Driver Earnings Recovery + Negative Isolation ───
    await login(page, admin1Email);
    await page.goto("/admin/commission-plans");
    const histItem = page.locator("li", { hasText: histOrderNumber });
    await expect(histItem).toBeVisible();
    await histItem.getByRole("button", { name: "Prepare QA Recovery", exact: true }).click();
    await expect(page.getByText(/QA historical settlement recovery prepared/)).toBeVisible();

    const commRecovRes = await page.request.post("/api/admin/qa-acceptance/settlement-recovery", {
      headers: { origin: new URL(page.url()).origin },
      data: {
        orderId: commHistOrderId,
        planPublicReference: qaCourierPlanRef,
        reason: "Negative commercial recovery test",
      },
    });
    expect(commRecovRes.status()).toBe(409);

    await login(page, admin2Email);
    await page.goto("/admin/commission-plans");
    await page
      .locator("li", { hasText: histOrderNumber })
      .getByRole("button", { name: /Independently Approve & Settle QA Earning/ })
      .click();
    await expect(page.getByText(/Approved & settled QA earning/)).toBeVisible();

    // ─── 8. Per-Order Financial Reconciliation on /admin/qa-acceptance ───
    await page.goto("/admin/qa-acceptance");
    await expect(page.getByText("5. Isolated Sandbox Ledger & Per-Order Reconciliation")).toBeVisible();
    await expect(page.getByText(histOrderNumber).first()).toBeVisible();

    // ─── 9. Permission-Aware Reconciliation UI + Stale Permission + Idempotent Replay ───
    await login(page, readOnlyAdminEmail);
    await page.goto("/admin/reconciliation");
    const roCaseRow = page.locator("tr", { hasText: createdReconCaseRef! });
    await expect(roCaseRow).toBeVisible();
    await roCaseRow.getByRole("button", { name: "Inspect", exact: true }).click();
    await expect(page.getByText("UNAVAILABLE · PERMISSION REQUIRED").first()).toBeVisible();
    await expect(page.getByText(`Required permission: ${PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE}`).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Execute Action", exact: true })).toHaveCount(0);

    const directUnauth = await page.request.post(
      `/api/admin/reconciliation/payments/${createdReconCaseRef}/actions/RETRY_PAYMENT_VERIFICATION`,
      {
        headers: { origin: new URL(page.url()).origin },
        data: {
          operationId: `RECOP-RO-${suffix.toUpperCase()}`,
          reasonCode: "UNAUTHORIZED_PROBE",
          confirmAction: "RETRY_PAYMENT_VERIFICATION",
        },
      },
    );
    expect(directUnauth.status()).toBe(403);

    const managePerm = await prisma.permission.findUniqueOrThrow({
      where: { key: PERMISSIONS.PAYMENT_RECONCILIATION_MANAGE },
    });
    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: readOnlyAdminId, permissionId: managePerm.id } },
      update: { effect: PermissionEffect.ALLOW },
      create: { userId: readOnlyAdminId, permissionId: managePerm.id, effect: PermissionEffect.ALLOW },
    });
    await page.reload();
    await page.locator("tr", { hasText: createdReconCaseRef! }).getByRole("button", { name: "Inspect", exact: true }).click();
    await expect(page.getByRole("button", { name: "Execute Action", exact: true }).first()).toBeEnabled();
    await page.getByRole("button", { name: "Execute Action", exact: true }).first().click();

    await prisma.userPermission.delete({
      where: { userId_permissionId: { userId: readOnlyAdminId, permissionId: managePerm.id } },
    });
    await page.getByPlaceholder("RETRY_PAYMENT_VERIFICATION").fill("RETRY_PAYMENT_VERIFICATION");
    const staleResPromise = page.waitForResponse((res) => res.url().includes("/actions/RETRY_PAYMENT_VERIFICATION"));
    await page.getByRole("button", { name: "Confirm & Execute", exact: true }).click();
    const staleRes = await staleResPromise;
    expect(staleRes.status()).toBe(403);
    await expect(page.getByText(/Unauthorized to execute recovery action/).first()).toBeVisible();
    await expect(page.getByText("UNAVAILABLE · PERMISSION REQUIRED").first()).toBeVisible();

    await login(page, admin1Email);
    await page.goto("/admin/reconciliation");
    await page.locator("tr", { hasText: createdReconCaseRef! }).getByRole("button", { name: "Inspect", exact: true }).click();
    await expect(page.getByText("AUTHORIZED").first()).toBeVisible();
    await page.getByRole("button", { name: "Execute Action", exact: true }).first().click();
    await page.getByPlaceholder("RETRY_PAYMENT_VERIFICATION").fill("RETRY_PAYMENT_VERIFICATION");
    await page.getByRole("button", { name: "Confirm & Execute", exact: true }).click();
    await expect(page.getByText(/Recovery action 'RETRY_PAYMENT_VERIFICATION' executed successfully/)).toBeVisible();

    // Already reconciled/resolved payment must block retry and reject new retry requests (409)
    await expect(page.getByRole("button", { name: "Execute Action", exact: true })).toHaveCount(0);
    const repeatAfterConverged = await page.request.post(
      `/api/admin/reconciliation/payments/${createdReconCaseRef}/actions/RETRY_PAYMENT_VERIFICATION`,
      {
        headers: { origin: new URL(page.url()).origin },
        data: {
          operationId: `RECOP-AFTER-CONVERGE-${suffix.toUpperCase()}`,
          reasonCode: "REPEAT_RETRY_BLOCKED_CHECK",
          confirmAction: "RETRY_PAYMENT_VERIFICATION",
        },
      },
    );
    expect(repeatAfterConverged.status()).toBe(409);

    // ─── 10. Matrix EXCLUDED_BY_POLICY, QA_FUNCTIONAL Submit/Review, & Live GitHub CI Verification ───
    await page.goto("/admin/production-readiness");
    await expect(page.getByText("EXCLUDED_BY_POLICY").first()).toBeVisible();
    await expect(page.locator("tr", { hasText: "Advertising Clicks & Managed Marketing" })).toContainText(
      "EXCLUDED_BY_POLICY",
    );

    const qaSection = page.locator("#acceptance-evidence");
    const qaForm = qaSection.locator("form", { hasText: "Verify & save QA functional draft" });
    await qaForm.locator("select").first().selectOption("qa_isolated_settlement_workflow");
    await qaForm.locator('input[name="releaseSha"]').fill(REAL_CERT_SHA);
    await qaForm.locator('input[name="qaRunReference"]').fill(createdRunRef!);
    await qaForm.locator('input[name="evidenceReference"]').fill(`e2e:qa-op:${suffix}`);
    await qaForm.locator('input[name="orderNumber"]').fill(histOrderNumber);
    await qaForm.locator('input[name="reason"]').fill("Interactive browser E2E verification of QA checkout-to-delivery lane");
    await qaForm.getByRole("button", { name: "Verify & save QA functional draft" }).click();
    await expect(page.getByText(/Server-verified QA functional draft saved/)).toBeVisible();

    const commForm = qaSection.locator("form", { hasText: "Save commercial draft" });
    await commForm.locator("select").first().selectOption("current_ci_certification");
    await commForm.locator('input[name="releaseSha"]').fill(REAL_CERT_SHA);
    await commForm.locator('input[name="evidenceReference"]').fill(`ci:45984912077:${suffix}`);
    await commForm.locator('input[name="observedAt"]').fill("2026-11-27T18:00");
    await commForm.locator('input[name="expiresAt"]').fill("2026-12-27T18:00");
    await commForm.locator('input[name="runUrl"]').fill(REAL_CERT_RUN_URL);
    await commForm.locator('input[name="testsPassed"]').fill("5933");
    await commForm.locator('input[name="reason"]').fill("Verified public main CI and 26-job certification run against exact release SHA");
    await commForm.locator('input[type="checkbox"]').check();
    await commForm.getByRole("button", { name: "Save commercial draft" }).click();
    await expect(page.getByText("Commercial draft saved. Independent review is required.")).toBeVisible({
      timeout: 30_000,
    });

    const badCiRes = await page.request.post("/api/admin/production-readiness", {
      headers: { origin: new URL(page.url()).origin },
      data: {
        expectedVersion: 1,
        evidence: {
          kind: "CI",
          key: "current_ci_certification",
          releaseSha: "0".repeat(40),
          observedAt: "2026-11-27T18:00:00.000Z",
          expiresAt: "2026-12-27T18:00:00.000Z",
          evidenceReference: "ci:tampered",
          reason: "Tampered release SHA must fail closed",
          runUrl: REAL_CERT_RUN_URL,
          conclusion: "SUCCESS",
          skippedCriticalTests: 0,
          testsPassed: 5933,
        },
      },
    });
    expect(badCiRes.status()).toBe(409);

    await login(page, admin2Email);
    await page.goto("/admin/production-readiness");
    const qaCard = page.locator("article", { hasText: "qa isolated settlement workflow" });
    await qaCard.locator('input[name="reason"]').fill("Second admin approved non-commercial QA functional proof");
    await qaCard.getByRole("button", { name: "Independently approve QA check", exact: true }).click();
    await expect(page.getByText(/QA functional acceptance review recorded/)).toBeVisible();

    const ciCard = page.locator("article", { hasText: "current ci certification" });
    await ciCard.locator('input[name="reason"]').fill("Second admin independently approved GitHub CI certification run");
    await ciCard.getByRole("button", { name: "Independently approve evidence", exact: true }).click();
    await expect(page.getByText(/Commercial evidence review recorded/)).toBeVisible({ timeout: 30_000 });

    // ─── 11. Reporting Journey: Navigation, Creation, Processing, CSV Download, Auth, Expiry & Reconciliation ───
    await page.goto("/admin/reports");
    await expect(page.getByRole("link", { name: /Request & Download Reports/i }).first()).toBeVisible();
    await page.locator('a[href="/admin/reports/jobs"]').first().click();
    await expect(page.getByRole("heading", { name: "System Report Jobs" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Request New Export/i })).toBeVisible();
    await page.getByRole("link", { name: /Request New Export/i }).click();
    await expect(page).toHaveURL(/\/reports$/);

    await page.locator("#report-definition-select").selectOption("admin-order-volume");
    await page.locator("#report-format-select").selectOption("CSV");
    const createReportPromise = page.waitForResponse(
      (res) => res.url().endsWith("/api/reports") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Generate Export", exact: true }).click();
    const createReportRes = await createReportPromise;
    expect(createReportRes.status()).toBe(200);
    const createdReportJson = (await createReportRes.json()) as { data: { publicReference: string } };
    const reportRef = createdReportJson.data.publicReference;
    createdReportJobRefs.push(reportRef);
    await expect(page.getByText(`Report job requested successfully: ${reportRef}`)).toBeVisible();

    // Process queued job via canonical background batch runner & verify CSV download in browser
    const batchOutcome = await runReportBatch(10, "QUEUED");
    expect(batchOutcome.completed).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "Refresh Jobs", exact: true }).click();
    await expect(page.locator("tr", { hasText: reportRef })).toContainText("COMPLETED");
    await page.locator("tr", { hasText: reportRef }).getByRole("link", { name: "View & Download" }).click();
    await expect(page.getByText("Export Artifact Ready")).toBeVisible();

    const [csvDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download Export Artifact", exact: true }).click(),
    ]);
    const csvDownloadPath = await csvDownload.path();
    expect(csvDownloadPath).toBeTruthy();
    const csvBytes = await (await import("node:fs/promises")).readFile(csvDownloadPath!, "utf8");
    expect(csvBytes).toContain("Order Reference");
    expect(csvBytes).toContain(histOrderNumber);

    // Expire artifact via canonical expiry worker & run admin reporting reconciliation UI scan
    const reportJobRow = await prisma.reportJob.findUniqueOrThrow({
      where: { publicReference: reportRef },
      select: { id: true },
    });
    await prisma.reportExportArtifact.updateMany({
      where: { jobId: reportJobRow.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expiryOutcome = await expireReportArtifacts({ limit: 50 });
    expect(expiryOutcome.deleted).toBeGreaterThanOrEqual(1);

    await page.reload();
    await expect(page.getByText(/Export artifact has expired/i)).toBeVisible();
    const expiredDownloadRes = await page.request.get(`/api/reports/${reportRef}/download`);
    expect(expiredDownloadRes.status()).toBe(400);

    await page.goto("/admin/reports/reconciliation");
    await page.getByRole("button", { name: "Dry-Run Scan", exact: true }).click();
    await expect(page.getByText(/Scan completed\./)).toBeVisible();

    // Unauthorized commercial customer cannot read or download admin report artifacts
    await login(page, commCustomerEmail);
    const unauthReportDetail = await page.request.get(`/api/reports/${reportRef}`);
    expect(unauthReportDetail.status()).toBe(403);
    const unauthReportDownload = await page.request.get(`/api/reports/${reportRef}/download`);
    expect(unauthReportDownload.status()).toBe(403);
    const unauthAdminJobs = await page.request.get("/api/admin/reports/jobs");
    expect(unauthAdminJobs.status()).toBe(403);

    await logout(page);
  });
});
