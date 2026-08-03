import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/guards";

export async function getApplicantContext() { const user = await requireAuth(); const profile = await prisma.recruitmentApplicantProfile.findUnique({ where: { userId: user.id } }); return { user, profile }; }
export async function getApplicantApplications() { const { profile } = await getApplicantContext(); if (!profile) return []; return prisma.recruitmentApplication.findMany({ where: { applicantProfileId: profile.id }, include: { openingVersion: true }, orderBy: { createdAt: "desc" } }); }
export async function getApplicantApplication(reference: string) {
  const { profile } = await getApplicantContext();
  if (!profile) return null;
  return prisma.recruitmentApplication.findFirst({
    where: { publicReference: reference, applicantProfileId: profile.id },
    include: {
      openingVersion: true, answers: true, documents: true,
      formVersion: { include: { sections: { orderBy: { displayOrder: "asc" }, include: { questions: { orderBy: { displayOrder: "asc" } } } } } },
      interviews: { include: { slot: true }, orderBy: { createdAt: "desc" } },
      checkCases: true,
      offers: { include: { currentVersion: true }, orderBy: { createdAt: "desc" } },
    },
  });
}
