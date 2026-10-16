import type { Metadata } from "next";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { listOwnPrivacyRequests } from "@/lib/services/privacy-requests.service";
import {
  CustomerSecurityWorkbench,
  type SecurityUserDto,
  type SecuritySessionDto,
  type SecurityLoginHistoryDto,
  type SecurityPrivacyRequestDto,
} from "@/components/customer/CustomerSecurityWorkbench";

export const metadata: Metadata = { title: "Account Security & Privacy" };

export default async function SecurityPage() {
  const authUser = await requireAuth();

  const [dbUser, rawSessions, rawLoginHistory, rawPrivacyRequests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.session.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
      },
    }),
    prisma.loginHistory.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        success: true,
        failureReason: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    }),
    listOwnPrivacyRequests(authUser.id).catch(() => []),
  ]);

  const userDto: SecurityUserDto = {
    id: authUser.id,
    email: dbUser?.email || authUser.email || "",
    name: dbUser?.name || authUser.name || null,
    phone: dbUser?.phone || null,
    role: dbUser?.role || authUser.role || "CUSTOMER",
    status: dbUser?.status || "ACTIVE",
    emailVerifiedAt: dbUser?.emailVerifiedAt?.toISOString() || null,
    lastLoginAt: dbUser?.lastLoginAt?.toISOString() || null,
    createdAt: dbUser?.createdAt?.toISOString() || new Date().toISOString(),
  };

  const sessionsDto: SecuritySessionDto[] = rawSessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    revokedAt: s.revokedAt?.toISOString() || null,
    revokedReason: s.revokedReason || null,
  }));

  const loginHistoryDto: SecurityLoginHistoryDto[] = rawLoginHistory.map((l) => ({
    id: l.id,
    success: l.success,
    failureReason: l.failureReason,
    ipAddress: l.ipAddress,
    userAgent: l.userAgent,
    createdAt: l.createdAt.toISOString(),
  }));

  const privacyRequestsDto: SecurityPrivacyRequestDto[] = (rawPrivacyRequests as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id || ""),
    publicReference: String(r.publicReference || ""),
    requestType: String(r.requestType || ""),
    status: String(r.status || "RECEIVED"),
    identityVerificationStatus: String(r.identityVerificationStatus || "REQUIRED"),
    decision: typeof r.decision === "string" ? r.decision : null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || new Date().toISOString()),
  }));

  return (
    <CustomerPage
      eyebrow="Account security"
      title="Security & POPIA Data Privacy"
      description="Manage active device sessions, inspect recent authentication activity, and exercise statutory data privacy rights under POPIA."
    >
      <CustomerSecurityWorkbench
        user={userDto}
        initialSessions={sessionsDto}
        initialLoginHistory={loginHistoryDto}
        initialPrivacyRequests={privacyRequestsDto}
      />
    </CustomerPage>
  );
}
