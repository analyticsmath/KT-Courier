import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverAvailabilityToggle } from "@/components/driver/DriverAvailabilityToggle";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileByUserId } from "@/lib/services/driver-profile.service";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Availability" };

export default async function DriverAvailabilityPage() {
  const user = await requireRole(UserRole.DRIVER);
  const driver = await getDriverProfileByUserId(user.id);
  if (!driver) notFound();
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver operations" title="Availability" description="Set your confirmed dispatch availability using the existing server-authoritative control." /><DriverAvailabilityToggle initialDriver={driver} /></ProtectedPageFrame>;
}
