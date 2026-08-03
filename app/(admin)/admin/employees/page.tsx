import type { Metadata } from "next";
import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";
import { listAdminEmployees } from "@/lib/services/admin-employees.service";

export const metadata: Metadata = { title: "Employees" };

export default async function AdminEmployeesPage() {
  await requireAdminPagePermission(PERMISSIONS.EMPLOYEES_READ);
  const employees = await listAdminEmployees();

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Governance" title="Employees" description="Administrative employee accounts and the recorded scope of their effective permission coverage." />
    <OperationalPanel title="Administrative employee directory" description="Account status and effective permission count are server-selected. This page does not calculate effective access in the browser.">
      <EditorialTable caption="Administrative employee accounts" mobileMode="stack" rows={employees} emptyState={<p className="eo-table-empty" role="status">No employees are available.</p>} columns={[
        { id: "employee", header: "Employee", priority: "primary", cell: (employee) => <>{employee.name ?? employee.adminProfile?.displayName ?? employee.email}<small>{employee.email}</small></> },
        { id: "role", header: "Role", priority: "secondary", cell: (employee) => employee.role },
        { id: "profile", header: "Profile", priority: "optional", cell: (employee) => <>{employee.adminProfile?.jobTitle ?? "No title"}<small>{employee.adminProfile?.department ?? "No department"}</small></> },
        { id: "status", header: "State", cell: (employee) => <ProtectedStatus {...presentR21Status(employee.status)} /> },
        { id: "permissions", header: "Effective permissions", align: "end", cell: (employee) => employee.effectivePermissionCount },
        { id: "last-login", header: "Last login", priority: "optional", cell: (employee) => employee.lastLoginAt ? new Date(employee.lastLoginAt).toLocaleDateString("en-ZA") : "Never" },
      ]} />
    </OperationalPanel>
  </ProtectedPageFrame>;
}
