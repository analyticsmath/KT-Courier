import type { Metadata } from "next";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CompanyProfileForm, type CompanyProfileFormData } from "@/components/admin/CompanyProfileForm";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { currentCompanyProfile } from "@/lib/services/company-profile.service";
import { parseTelephoneNumbers } from "@/lib/shipment-documents/projection";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Company issuer profile" };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function AdminCompanyProfilePage() {
  const user = await requireAdminPagePermission(PERMISSIONS.COMPANY_SETTINGS_READ);
  const canManage =
    user.role === UserRole.SUPER_ADMIN ||
    (await hasPermission({
      userId: user.id,
      role: user.role,
      permissionKey: PERMISSIONS.COMPANY_SETTINGS_MANAGE,
    }));

  const current = await currentCompanyProfile();
  const addr = asRecord(current?.physicalAddress);
  const meta = asRecord(current?.documentIdentityMetadata);

  const initial: CompanyProfileFormData | null = current
    ? {
        publicReference: current.publicReference ?? null,
        versionNumber: current.versionNumber,
        legalName: current.legalName,
        tradingName: current.tradingName ?? "",
        registrationNumber: current.registrationNumber ?? "",
        vatNumber: current.vatNumber ?? "",
        supportEmail: current.supportEmail ?? "",
        businessEmail: current.businessEmail ?? "",
        telephoneNumbersText: parseTelephoneNumbers(current.telephoneNumbers).join(", "),
        website: current.website ?? "",
        addressLine1: typeof addr.line1 === "string" ? addr.line1 : "",
        addressCity: typeof addr.city === "string" ? addr.city : "",
        addressProvince: typeof addr.province === "string" ? addr.province : "",
        addressPostalCode: typeof addr.postalCode === "string" ? addr.postalCode : "",
        walkInOffice: meta.walkInOffice === true,
        activatedAtIso: current.activatedAt ? current.activatedAt.toISOString() : null,
      }
    : null;

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Governance · Commercial Identity"
        title="Company issuer profile"
        description="Versioned legal and operational identity captured immutably on KT Couriers Waybills, Proof of Delivery certificates, invoices, and notifications."
        actions={
          <Link className="eo-inline-action" href="/admin/settings">
            System settings
          </Link>
        }
      />
      <CompanyProfileForm initial={initial} canManage={canManage} />
    </ProtectedPageFrame>
  );
}
