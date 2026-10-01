import { prisma } from "@/lib/db/prisma";
import { ProfileAvatar } from "@/components/forms/ProfileAvatar";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriverProfileForm } from "@/components/driver/DriverProfileForm";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileByUserId } from "@/lib/services/driver-profile.service";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Driver profile" };

export default async function DriverProfilePage() {
  const user = await requireRole(UserRole.DRIVER);
  const driver = await getDriverProfileByUserId(user.id);
  if (!driver) notFound();
  const avatar = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarMediaReference: true },
  });
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Driver account"
        title="Profile and vehicle"
        description="Driver-owned contact details, source-backed vehicle information, and service-region coverage."
      />
      <OperationalPanel title="Profile image">
        <ProfileAvatar hasAvatar={!!avatar?.avatarMediaReference} />
      </OperationalPanel>
      <DriverProfileForm initialDriver={driver} />
    </ProtectedPageFrame>
  );
}
