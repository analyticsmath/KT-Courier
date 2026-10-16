import { prisma } from "@/lib/db/prisma";
import {
  DocumentStatus,
  DocumentType,
  DriverAvailability,
  DriverStatus,
  UserRole,
  UserStatus,
  VehicleComplianceStatus,
  VehicleDocumentType,
} from "@/types/db";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/constants/assignments";

export type DriverReadinessChecklistKey =
  | "USER_ACCOUNT"
  | "DRIVER_PROFILE"
  | "IDENTITY_DOCUMENT"
  | "DRIVING_LICENCE"
  | "SERVICE_REGIONS"
  | "COMPLIANT_VEHICLE"
  | "AVAILABILITY"
  | "ASSIGNMENT_CAPACITY";

export type ChecklistItemStatus =
  | "COMPLETED"
  | "PENDING_REVIEW"
  | "MISSING"
  | "REJECTED"
  | "EXPIRED"
  | "BLOCKED";

export interface DriverReadinessBlocker {
  key: string;
  category: "IDENTITY" | "LICENCE" | "VEHICLE" | "REGION" | "ACCOUNT" | "AVAILABILITY" | "CAPACITY";
  message: string;
  actionLabel: string;
  actionHref: string;
}

export interface DriverReadinessChecklistItem {
  key: DriverReadinessChecklistKey;
  label: string;
  description: string;
  status: ChecklistItemStatus;
  detail?: string;
  actionLabel?: string;
  actionHref?: string;
}

export interface DriverReadinessEvaluation {
  driverProfileId: string;
  driverCode: string;
  displayName: string | null;
  isDispatchReady: boolean;
  canBeAvailable: boolean;
  currentAvailability: DriverAvailability;
  profileStatus: DriverStatus;
  userStatus: UserStatus;
  reasons: string[];
  blockers: DriverReadinessBlocker[];
  checklist: DriverReadinessChecklistItem[];
  activeAssignmentCount: number;
  maxConcurrentAssignments: number;
  approvedVehicleId: string | null;
  regionCount: number;
}

/**
 * Single authoritative readiness evaluation for a driver.
 * Evaluates account role, profile status, identity document, driving licence,
 * service region configuration, vehicle approval & compliance documents/photos,
 * availability status, and concurrent assignment capacity.
 */
export async function evaluateDriverReadiness(
  driverProfileId: string,
  options: { now?: Date } = {}
): Promise<DriverReadinessEvaluation | null> {
  const now = options.now ?? new Date();

  const driver = await prisma.driverProfile.findUnique({
    where: { id: driverProfileId },
    include: {
      user: {
        select: {
          id: true,
          status: true,
          role: true,
          email: true,
          phone: true,
        },
      },
      documents: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      },
      vehicles: {
        where: { archivedAt: null },
        include: {
          documents: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          },
          media: true,
        },
      },
      serviceRegions: {
        include: {
          deliveryRegion: true,
        },
      },
    },
  });

  if (!driver) return null;

  const activeAssignmentCount = await prisma.orderAssignment.count({
    where: {
      driverProfileId: driver.id,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      OR: [
        { status: "ACCEPTED" },
        { status: "ASSIGNED", expiresAt: { gt: now } },
        { status: "ASSIGNED", expiresAt: null },
      ],
    },
  });

  const checklist: DriverReadinessChecklistItem[] = [];
  const blockers: DriverReadinessBlocker[] = [];
  const reasons: string[] = [];

  // 1. USER_ACCOUNT
  const isUserActive = driver.user.status === UserStatus.ACTIVE;
  const isUserDriver = driver.user.role === UserRole.DRIVER;
  let userAccountStatus: ChecklistItemStatus = "COMPLETED";
  let userAccountDetail = "Account is active";

  if (!isUserActive) {
    userAccountStatus = "BLOCKED";
    userAccountDetail = `Account status is ${driver.user.status}`;
    reasons.push("DRIVER_USER_INACTIVE");
    blockers.push({
      key: "USER_INACTIVE",
      category: "ACCOUNT",
      message: `Your user account is ${driver.user.status.toLowerCase()}. Contact support to activate your account.`,
      actionLabel: "Contact Support",
      actionHref: "/contact",
    });
  } else if (!isUserDriver) {
    userAccountStatus = "BLOCKED";
    userAccountDetail = `Account role is ${driver.user.role}`;
    reasons.push("DRIVER_USER_ROLE_INVALID");
    blockers.push({
      key: "USER_ROLE_INVALID",
      category: "ACCOUNT",
      message: "Your user account does not have the DRIVER role.",
      actionLabel: "Contact Support",
      actionHref: "/contact",
    });
  }

  checklist.push({
    key: "USER_ACCOUNT",
    label: "Account Status",
    description: "Verified active driver user account",
    status: userAccountStatus,
    detail: userAccountDetail,
  });

  // 2. DRIVER_PROFILE
  let profileStatus: ChecklistItemStatus = "COMPLETED";
  let profileDetail = `Profile is ${driver.status.toLowerCase()}`;

  if (driver.status === DriverStatus.ACTIVE) {
    profileStatus = "COMPLETED";
    profileDetail = "Profile is active and verified";
  } else if (driver.status === DriverStatus.PENDING_REVIEW) {
    profileStatus = "PENDING_REVIEW";
    profileDetail = "Under review by KT Couriers operations";
    reasons.push("DRIVER_PROFILE_PENDING_REVIEW");
    blockers.push({
      key: "PROFILE_PENDING_REVIEW",
      category: "ACCOUNT",
      message: "Your driver profile is currently under review by KT Couriers operations.",
      actionLabel: "View Status",
      actionHref: "/driver/onboarding",
    });
  } else if (driver.status === DriverStatus.SUSPENDED) {
    profileStatus = "BLOCKED";
    profileDetail = driver.suspensionReason ? `Suspended: ${driver.suspensionReason}` : "Profile is suspended";
    reasons.push("DRIVER_PROFILE_SUSPENDED");
    blockers.push({
      key: "PROFILE_SUSPENDED",
      category: "ACCOUNT",
      message: driver.suspensionReason
        ? `Driver profile suspended: ${driver.suspensionReason}`
        : "Driver profile is suspended. Contact support.",
      actionLabel: "Contact Support",
      actionHref: "/contact",
    });
  } else if (driver.status === DriverStatus.REJECTED) {
    profileStatus = "REJECTED";
    profileDetail = driver.rejectionReason ? `Rejected: ${driver.rejectionReason}` : "Profile was rejected";
    reasons.push("DRIVER_PROFILE_REJECTED");
    blockers.push({
      key: "PROFILE_REJECTED",
      category: "ACCOUNT",
      message: driver.rejectionReason
        ? `Driver profile was rejected: ${driver.rejectionReason}`
        : "Driver profile was rejected. Update details to resubmit.",
      actionLabel: "Review Profile",
      actionHref: "/driver/onboarding",
    });
  } else {
    profileStatus = "BLOCKED";
    profileDetail = "Profile is inactive";
    reasons.push("DRIVER_PROFILE_INACTIVE");
    blockers.push({
      key: "PROFILE_INACTIVE",
      category: "ACCOUNT",
      message: "Driver profile is inactive.",
      actionLabel: "Update Profile",
      actionHref: "/driver/onboarding",
    });
  }

  checklist.push({
    key: "DRIVER_PROFILE",
    label: "Driver Profile",
    description: "Operational driver profile approval",
    status: profileStatus,
    detail: profileDetail,
    actionLabel: profileStatus !== "COMPLETED" ? "Review Details" : undefined,
    actionHref: profileStatus !== "COMPLETED" ? "/driver/onboarding" : undefined,
  });

  // 3. IDENTITY_DOCUMENT
  const idDocs = driver.documents.filter((d) => d.documentType === DocumentType.ID_DOCUMENT);
  const activeIdDoc = idDocs.find((d) => d.status === DocumentStatus.APPROVED);
  const pendingIdDoc = idDocs.find((d) => d.status === DocumentStatus.SUBMITTED || d.status === DocumentStatus.PENDING);
  const rejectedIdDoc = idDocs.find((d) => d.status === DocumentStatus.REJECTED);

  let idStatus: ChecklistItemStatus = "MISSING";
  let idDetail = "Not provided";

  if (activeIdDoc) {
    if (activeIdDoc.expiresAt && activeIdDoc.expiresAt <= now) {
      idStatus = "EXPIRED";
      idDetail = `Expired on ${activeIdDoc.expiresAt.toISOString().split("T")[0]}`;
      reasons.push("DRIVER_DOCUMENT_ID_DOCUMENT_EXPIRED");
      blockers.push({
        key: "ID_DOCUMENT_EXPIRED",
        category: "IDENTITY",
        message: "Your identity document has expired. Upload a renewed document.",
        actionLabel: "Upload Document",
        actionHref: "/driver/onboarding?tab=documents",
      });
    } else {
      idStatus = "COMPLETED";
      idDetail = "Verified valid identity document";
    }
  } else if (pendingIdDoc) {
    idStatus = "PENDING_REVIEW";
    idDetail = "Document uploaded, awaiting verification";
    reasons.push("DRIVER_DOCUMENT_ID_DOCUMENT_PENDING");
    blockers.push({
      key: "ID_DOCUMENT_PENDING",
      category: "IDENTITY",
      message: "Identity document has been uploaded and is awaiting administrator verification.",
      actionLabel: "View Documents",
      actionHref: "/driver/onboarding?tab=documents",
    });
  } else if (rejectedIdDoc) {
    idStatus = "REJECTED";
    idDetail = rejectedIdDoc.rejectionReason ? `Rejected: ${rejectedIdDoc.rejectionReason}` : "Document was rejected";
    reasons.push("DRIVER_DOCUMENT_ID_DOCUMENT_REJECTED");
    blockers.push({
      key: "ID_DOCUMENT_REJECTED",
      category: "IDENTITY",
      message: rejectedIdDoc.rejectionReason
        ? `Identity document rejected: ${rejectedIdDoc.rejectionReason}. Upload a new copy.`
        : "Identity document was rejected. Upload a new copy.",
      actionLabel: "Upload New Copy",
      actionHref: "/driver/onboarding?tab=documents",
    });
  } else {
    idStatus = "MISSING";
    idDetail = "No identity document uploaded";
    reasons.push("DRIVER_DOCUMENT_ID_DOCUMENT_INVALID");
    blockers.push({
      key: "ID_DOCUMENT_MISSING",
      category: "IDENTITY",
      message: "Valid South African ID or passport document is required.",
      actionLabel: "Upload Document",
      actionHref: "/driver/onboarding?tab=documents",
    });
  }

  checklist.push({
    key: "IDENTITY_DOCUMENT",
    label: "Identity Document",
    description: "South African ID or valid passport",
    status: idStatus,
    detail: idDetail,
    actionLabel: idStatus !== "COMPLETED" ? "Manage Documents" : undefined,
    actionHref: idStatus !== "COMPLETED" ? "/driver/onboarding?tab=documents" : undefined,
  });

  // 4. DRIVING_LICENCE
  const licenseDocs = driver.documents.filter((d) => d.documentType === DocumentType.LICENSE);
  const activeLicenseDoc = licenseDocs.find((d) => d.status === DocumentStatus.APPROVED);
  const pendingLicenseDoc = licenseDocs.find((d) => d.status === DocumentStatus.SUBMITTED || d.status === DocumentStatus.PENDING);
  const rejectedLicenseDoc = licenseDocs.find((d) => d.status === DocumentStatus.REJECTED);

  let licenseStatus: ChecklistItemStatus = "MISSING";
  let licenseDetail = "Not provided";

  if (activeLicenseDoc) {
    if (activeLicenseDoc.expiresAt && activeLicenseDoc.expiresAt <= now) {
      licenseStatus = "EXPIRED";
      licenseDetail = `Expired on ${activeLicenseDoc.expiresAt.toISOString().split("T")[0]}`;
      reasons.push("DRIVER_DOCUMENT_LICENSE_EXPIRED");
      blockers.push({
        key: "LICENSE_EXPIRED",
        category: "LICENCE",
        message: "Your driving licence document has expired. Upload a renewed licence.",
        actionLabel: "Upload Licence",
        actionHref: "/driver/onboarding?tab=documents",
      });
    } else {
      licenseStatus = "COMPLETED";
      licenseDetail = "Verified valid driving licence";
    }
  } else if (pendingLicenseDoc) {
    licenseStatus = "PENDING_REVIEW";
    licenseDetail = "Licence uploaded, awaiting verification";
    reasons.push("DRIVER_DOCUMENT_LICENSE_PENDING");
    blockers.push({
      key: "LICENSE_PENDING",
      category: "LICENCE",
      message: "Driving licence has been uploaded and is awaiting administrator verification.",
      actionLabel: "View Documents",
      actionHref: "/driver/onboarding?tab=documents",
    });
  } else if (rejectedLicenseDoc) {
    licenseStatus = "REJECTED";
    licenseDetail = rejectedLicenseDoc.rejectionReason
      ? `Rejected: ${rejectedLicenseDoc.rejectionReason}`
      : "Licence was rejected";
    reasons.push("DRIVER_DOCUMENT_LICENSE_REJECTED");
    blockers.push({
      key: "LICENSE_REJECTED",
      category: "LICENCE",
      message: rejectedLicenseDoc.rejectionReason
        ? `Driving licence rejected: ${rejectedLicenseDoc.rejectionReason}. Upload a new copy.`
        : "Driving licence was rejected. Upload a new copy.",
      actionLabel: "Upload New Licence",
      actionHref: "/driver/onboarding?tab=documents",
    });
  } else {
    licenseStatus = "MISSING";
    licenseDetail = "No driving licence uploaded";
    reasons.push("DRIVER_DOCUMENT_LICENSE_INVALID");
    blockers.push({
      key: "LICENSE_MISSING",
      category: "LICENCE",
      message: "Valid South African driving licence document is required.",
      actionLabel: "Upload Licence",
      actionHref: "/driver/onboarding?tab=documents",
    });
  }

  checklist.push({
    key: "DRIVING_LICENCE",
    label: "Driving Licence",
    description: "Valid South African driving licence card",
    status: licenseStatus,
    detail: licenseDetail,
    actionLabel: licenseStatus !== "COMPLETED" ? "Manage Documents" : undefined,
    actionHref: licenseStatus !== "COMPLETED" ? "/driver/onboarding?tab=documents" : undefined,
  });

  // 5. SERVICE_REGIONS
  const regionCount = driver.serviceRegions.length;
  let regionStatus: ChecklistItemStatus = "COMPLETED";
  let regionDetail = `${regionCount} service region(s) assigned`;

  if (regionCount === 0) {
    regionStatus = "MISSING";
    regionDetail = "No delivery regions configured";
    reasons.push("DRIVER_NO_SERVICE_REGIONS");
    blockers.push({
      key: "NO_SERVICE_REGIONS",
      category: "REGION",
      message: "No delivery service regions selected. Choose at least one operating region to receive delivery offers.",
      actionLabel: "Select Regions",
      actionHref: "/driver/onboarding?tab=regions",
    });
  }

  checklist.push({
    key: "SERVICE_REGIONS",
    label: "Operating Regions",
    description: "Assigned delivery zones and coverage areas",
    status: regionStatus,
    detail: regionDetail,
    actionLabel: regionCount === 0 ? "Choose Regions" : undefined,
    actionHref: regionCount === 0 ? "/driver/onboarding?tab=regions" : undefined,
  });

  // 6. COMPLIANT_VEHICLE
  const requiredVehicleDocTypes = [
    VehicleDocumentType.REGISTRATION,
    VehicleDocumentType.LICENCE_DISC,
    VehicleDocumentType.INSURANCE,
  ];

  let compliantVehicleId: string | null = null;
  let vehicleStatus: ChecklistItemStatus = "MISSING";
  let vehicleDetail = "No compliant vehicle registered";

  if (driver.vehicles.length === 0) {
    vehicleStatus = "MISSING";
    vehicleDetail = "No registered vehicle";
    reasons.push("NO_COMPLIANT_APPROVED_VEHICLE");
    blockers.push({
      key: "NO_REGISTERED_VEHICLE",
      category: "VEHICLE",
      message: "Register a delivery vehicle and upload required documents (registration, licence disc, insurance) and photos.",
      actionLabel: "Add Vehicle",
      actionHref: "/driver/onboarding?tab=vehicles",
    });
  } else {
    // Check if there is an approved vehicle with valid documents
    const approvedVehicles = driver.vehicles.filter((v) => v.status === VehicleComplianceStatus.APPROVED);

    for (const v of approvedVehicles) {
      const allDocsValid = requiredVehicleDocTypes.every((docType) =>
        v.documents.some(
          (d) =>
            d.documentType === docType &&
            d.status === DocumentStatus.APPROVED &&
            (!d.expiresAt || d.expiresAt > now)
        )
      );
      if (allDocsValid) {
        compliantVehicleId = v.id;
        vehicleStatus = "COMPLETED";
        vehicleDetail = `${v.make} ${v.model} (${v.registrationNumber}) - Approved`;
        break;
      }
    }

    if (!compliantVehicleId) {
      reasons.push("NO_COMPLIANT_APPROVED_VEHICLE");

      // Check if vehicles are pending review, rejected, or missing documents
      const pendingVehicles = driver.vehicles.filter((v) => v.status === VehicleComplianceStatus.PENDING_REVIEW);
      const rejectedVehicles = driver.vehicles.filter((v) => v.status === VehicleComplianceStatus.REJECTED);

      if (pendingVehicles.length > 0) {
        vehicleStatus = "PENDING_REVIEW";
        vehicleDetail = "Vehicle submitted, awaiting administrator approval";
        blockers.push({
          key: "VEHICLE_PENDING_REVIEW",
          category: "VEHICLE",
          message: "Your registered vehicle is currently awaiting administrator review and approval.",
          actionLabel: "View Vehicles",
          actionHref: "/driver/onboarding?tab=vehicles",
        });
      } else if (rejectedVehicles.length === driver.vehicles.length) {
        vehicleStatus = "REJECTED";
        vehicleDetail = "All registered vehicles were rejected";
        blockers.push({
          key: "VEHICLE_REJECTED",
          category: "VEHICLE",
          message: "Your vehicle registration was rejected. Review the rejection reasons and update or add a compliant vehicle.",
          actionLabel: "Update Vehicle",
          actionHref: "/driver/onboarding?tab=vehicles",
        });
      } else {
        // Vehicle exists, but documents or photos are incomplete or expired
        vehicleStatus = "PENDING_REVIEW";
        vehicleDetail = "Vehicle documents (registration, licence disc, insurance) or photos require verification";
        blockers.push({
          key: "VEHICLE_DOCUMENTS_INCOMPLETE",
          category: "VEHICLE",
          message: "Vehicle registration, licence disc, or insurance documents are pending, expired, or missing.",
          actionLabel: "Manage Vehicle Documents",
          actionHref: "/driver/onboarding?tab=vehicles",
        });
      }
    }
  }

  checklist.push({
    key: "COMPLIANT_VEHICLE",
    label: "Compliant Vehicle",
    description: "Approved vehicle with valid registration, licence disc, and insurance",
    status: vehicleStatus,
    detail: vehicleDetail,
    actionLabel: vehicleStatus !== "COMPLETED" ? "Manage Fleet" : undefined,
    actionHref: vehicleStatus !== "COMPLETED" ? "/driver/onboarding?tab=vehicles" : undefined,
  });

  // Check canBeAvailable (ready to go online): Account, Profile, Identity, Licence, Regions, Vehicle must all be COMPLETED
  const canBeAvailable =
    userAccountStatus === "COMPLETED" &&
    profileStatus === "COMPLETED" &&
    idStatus === "COMPLETED" &&
    licenseStatus === "COMPLETED" &&
    regionStatus === "COMPLETED" &&
    vehicleStatus === "COMPLETED";

  // 7. AVAILABILITY
  let availabilityStatus: ChecklistItemStatus = "COMPLETED";
  let availabilityDetail = `Status: ${driver.availability.toLowerCase()}`;

  if (driver.availability === DriverAvailability.AVAILABLE) {
    availabilityStatus = "COMPLETED";
    availabilityDetail = "Online and ready to accept delivery offers";
  } else {
    availabilityStatus = "MISSING";
    availabilityDetail = `Currently ${driver.availability.toLowerCase()}`;
    reasons.push("DRIVER_UNAVAILABLE");
    if (canBeAvailable) {
      blockers.push({
        key: "DRIVER_OFFLINE",
        category: "AVAILABILITY",
        message: "You are currently offline. Set your status to Available to receive delivery offers.",
        actionLabel: "Go Online",
        actionHref: "/driver",
      });
    } else {
      blockers.push({
        key: "DRIVER_OFFLINE_COMPLIANCE_REQUIRED",
        category: "AVAILABILITY",
        message: "You must complete required compliance verification before you can go online.",
        actionLabel: "View Requirements",
        actionHref: "/driver/onboarding",
      });
    }
  }

  checklist.push({
    key: "AVAILABILITY",
    label: "Dispatch Availability",
    description: "Driver status set to Available for dispatch offers",
    status: availabilityStatus,
    detail: availabilityDetail,
    actionLabel: driver.availability !== DriverAvailability.AVAILABLE && canBeAvailable ? "Go Online" : undefined,
    actionHref: driver.availability !== DriverAvailability.AVAILABLE && canBeAvailable ? "/driver" : undefined,
  });

  // 8. ASSIGNMENT_CAPACITY
  let capacityStatus: ChecklistItemStatus = "COMPLETED";
  let capacityDetail = `${activeAssignmentCount}/${driver.maxConcurrentAssignments} active assignment(s)`;

  if (activeAssignmentCount >= driver.maxConcurrentAssignments) {
    capacityStatus = "BLOCKED";
    capacityDetail = `Maximum capacity reached (${activeAssignmentCount}/${driver.maxConcurrentAssignments})`;
    reasons.push("DRIVER_CAPACITY_REACHED");
    blockers.push({
      key: "CAPACITY_REACHED",
      category: "CAPACITY",
      message: `You have reached your maximum active assignments limit (${activeAssignmentCount}/${driver.maxConcurrentAssignments}). Complete current deliveries to receive new offers.`,
      actionLabel: "View Assignments",
      actionHref: "/driver/assignments",
    });
  }

  checklist.push({
    key: "ASSIGNMENT_CAPACITY",
    label: "Assignment Capacity",
    description: "Capacity to accept additional concurrent orders",
    status: capacityStatus,
    detail: capacityDetail,
  });

  // Full dispatch readiness
  const isDispatchReady =
    canBeAvailable &&
    availabilityStatus === "COMPLETED" &&
    capacityStatus === "COMPLETED";

  return {
    driverProfileId: driver.id,
    driverCode: driver.driverCode,
    displayName: driver.displayName,
    isDispatchReady,
    canBeAvailable,
    currentAvailability: driver.availability,
    profileStatus: driver.status,
    userStatus: driver.user.status,
    reasons,
    blockers,
    checklist,
    activeAssignmentCount,
    maxConcurrentAssignments: driver.maxConcurrentAssignments,
    approvedVehicleId: compliantVehicleId,
    regionCount,
  };
}

/**
 * Driver self-service helper: evaluates readiness using the authenticated driver's user ID.
 */
export async function evaluateDriverReadinessByUserId(
  userId: string,
  options: { now?: Date } = {}
): Promise<DriverReadinessEvaluation | null> {
  const driver = await prisma.driverProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!driver) return null;
  return evaluateDriverReadiness(driver.id, options);
}
