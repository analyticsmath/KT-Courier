import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverOnboardingExperience } from "@/components/driver/DriverOnboardingExperience";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileByUserId, listOwnDriverDocuments, getOwnDriverRegions } from "@/lib/services/driver-profile.service";
import { listOwnVehicles } from "@/lib/services/vehicle-compliance.service";
import { evaluateDriverReadiness } from "@/lib/services/driver-readiness.service";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Driver onboarding & compliance" };

export default async function DriverOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const user = await requireRole(UserRole.DRIVER);
  const driver = await getDriverProfileByUserId(user.id);
  if (!driver) notFound();

  const [rawDocs, rawVehicles, regionsData, readiness] = await Promise.all([
    listOwnDriverDocuments(user.id).catch(() => []),
    listOwnVehicles(user.id).catch(() => []),
    getOwnDriverRegions(user.id).catch(() => ({ allRegions: [], assignedRegions: [], primaryRegionId: null })),
    evaluateDriverReadiness(driver.id).catch(() => null),
  ]);

  const params = searchParams ? await searchParams : {};
  const requestedTab = params.tab;
  const initialTab = (requestedTab === "documents" || requestedTab === "vehicles" || requestedTab === "regions")
    ? requestedTab
    : "identity";

  const initialDocuments = rawDocs.map((d) => ({
    id: d.id,
    documentType: d.documentType,
    status: d.status,
    fileName: d.fileName,
    expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
    rejectionReason: d.rejectionReason,
    privateMediaObject: d.privateMediaObject ? {
      publicReference: d.privateMediaObject.publicReference,
      originalFileName: d.privateMediaObject.originalFileName,
    } : null,
  }));

  const initialVehicles = rawVehicles.map((v) => ({
    id: v.id,
    publicReference: v.publicReference,
    make: v.make,
    model: v.model,
    year: v.year,
    colour: v.colour,
    registrationNumber: v.registrationNumber,
    vehicleType: v.vehicleType,
    vehicleSubtype: v.vehicleSubtype,
    // Prisma.Decimal cannot be passed as a server→client component prop.
    capacityKg: v.capacityKg?.toString() ?? null,
    status: v.status,
    documents: v.documents.map((vd) => ({
      documentType: vd.documentType,
      status: vd.status,
      expiresAt: vd.expiresAt ? vd.expiresAt.toISOString() : null,
    })),
    media: v.media.map((image) => ({ purpose: image.purpose })),
  }));

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Driver onboarding"
        title="Identity & Fleet Verification"
        description="Submit your South African legal identity, driving credentials, and vehicle compliance documentation."
      />
      <DriverOnboardingExperience
        initialDriver={driver}
        initialDocuments={initialDocuments}
        initialVehicles={initialVehicles}
        initialRegions={regionsData}
        initialReadiness={readiness}
        initialTab={initialTab}
      />
    </ProtectedPageFrame>
  );
}
