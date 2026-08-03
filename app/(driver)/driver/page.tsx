import type { Metadata } from "next";
import { DriverHomePage } from "@/components/protected-v2/driver/DriverHomePage";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { AccessBoundaryIllustration } from "@/components/protected-v2/illustrations/AccessBoundaryIllustration";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileByUserId } from "@/lib/services/driver-profile.service";
import { getDriverProfileIdForUser, listDriverAssignments } from "@/lib/services/driver-assignments.service";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Driver home" };

export default async function DriverDashboardPage() {
  const user = await requireRole(UserRole.DRIVER);
  const driver = await getDriverProfileByUserId(user.id);
  if (!driver) {
    return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver operations" title="Driver profile unavailable" description="A driver profile is required before operational records can be loaded." /><ProtectedState kind="restricted" title="Driver profile not configured" description="An administrator must link and initialise your driver profile before this workspace can show assignments or availability." illustration={<AccessBoundaryIllustration className="h-24 w-32" />} /></ProtectedPageFrame>;
  }

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  const assignments = driverProfileId ? await listDriverAssignments(driverProfileId, "all") : [];
  return <DriverHomePage driver={driver} assignments={assignments} />;
}
