import { PrivacyRequestsManager, type PrivacyRequestItem } from "@/components/admin/PrivacyRequestsManager";
import { ProtectedPageFrame, ProtectedPageHeader } from "@/components/protected-v2";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPrivacyRequests } from "@/lib/services/privacy-requests.service";

export default async function PrivacyRequestsPage() {
  await requireAdminPagePermission(PERMISSIONS.PRIVACY_REQUESTS_READ);
  const requests = await listPrivacyRequests().catch(() => []);
  const initialRequests: PrivacyRequestItem[] = requests.flatMap((request) => {
    const id = stringValue(request.id);
    const publicReference = stringValue(request.publicReference);
    const requestType = stringOption(request.requestType, ["ACCESS", "DELETION", "CORRECTION"] as const);
    if (!id || !publicReference || !requestType) return [];
    return [{
      id,
      publicReference,
      requesterUserId: stringValue(request.requesterUserId) ?? null,
      requestType,
      status: stringValue(request.status) ?? "RECEIVED",
      identityVerificationStatus: stringValue(request.identityVerificationStatus) ?? "REQUIRED",
      scope: stringArray(request.scope),
      deadlineAt: optionalDateValue(request.deadlineAt),
      createdAt: dateValue(request.createdAt),
      completedAt: optionalDateValue(request.completedAt),
    }];
  });

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Governance"
        title="Privacy Requests & Data Retention"
        description="Manage identity-verified Subject Access & Erasure requests with hold evaluation safeguards."
      />

      <PrivacyRequestsManager initialRequests={initialRequests} />
    </ProtectedPageFrame>
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringOption<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return typeof value === "string" ? options.find((option) => option === value) : undefined;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
}

function dateValue(value: unknown): string {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : new Date(0).toISOString();
}

function optionalDateValue(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : typeof value === "string" ? value : null;
}
