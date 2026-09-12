import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverOnboardingExperience } from "@/components/driver/DriverOnboardingExperience";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileByUserId, listOwnDriverDocuments } from "@/lib/services/driver-profile.service";
import { listOwnVehicles } from "@/lib/services/vehicle-compliance.service";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Driver onboarding & compliance" };

export default async function DriverOnboardingPage() {
  const user = await requireRole(UserRole.DRIVER);
  const driver = await getDriverProfileByUserId(user.id);
  if (!driver) notFound();

  const [rawDocs, rawVehicles] = await Promise.all([
    listOwnDriverDocuments(user.id).catch(() => []),
    listOwnVehicles(user.id).catch(() => []),
  ]);

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
    status: v.status,
    documents: v.documents.map((vd) => ({
      documentType: vd.documentType,
      status: vd.status,
      expiresAt: vd.expiresAt ? vd.expiresAt.toISOString() : null,
    })),
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
      />
    </ProtectedPageFrame>
  );
}
