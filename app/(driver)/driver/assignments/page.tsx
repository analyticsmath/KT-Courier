import type { Metadata } from "next";
import Link from "next/link";
import { DriverAssignmentQueue } from "@/components/protected-v2/driver/DriverAssignmentQueue";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireRole } from "@/lib/auth/guards";
import { getDriverProfileIdForUser, listDriverAssignments } from "@/lib/services/driver-assignments.service";
import { UserRole } from "@/types/db";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Assignments" };

export default async function DriverAssignmentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireRole(UserRole.DRIVER);
  const { filter: filterParam } = await searchParams;
  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) redirect("/driver");
  const filter = filterParam === "active" || filterParam === "history" ? filterParam : "all";
  const assignments = await listDriverAssignments(driverProfileId, filter);
  return <ProtectedPageFrame><ProtectedPageHeader eyebrow="Driver operations" title="Assignments" description="Owned assignment records. Open a record to review its canonical next action." actions={<Link className="eo-text-link" href="/driver">Driver home</Link>} /><DriverAssignmentQueue assignments={assignments} filter={filter} /></ProtectedPageFrame>;
}
