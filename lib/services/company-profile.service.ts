import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CompanyProfileInput = Readonly<{
  legalName: string;
  tradingName?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  physicalAddress?: Record<string, unknown> | null;
  supportEmail?: string | null;
  businessEmail?: string | null;
  telephoneNumbers?: string[] | null;
  website?: string | null;
  publicMetadata?: Record<string, unknown> | null;
  documentIdentityMetadata?: Record<string, unknown> | null;
  effectiveAt?: Date;
}>;

function reference(versionNumber: number) {
  return `COMPANY-${String(versionNumber).padStart(6, "0")}`;
}

function cleanText(value: string | null | undefined, maximum: number) {
  const text = value?.trim();
  return text ? text.slice(0, maximum) : null;
}

function normalized(input: CompanyProfileInput) {
  const legalName = input.legalName.trim().slice(0, 240);
  if (!legalName) throw new Error("A legal company name is required.");
  return {
    legalName,
    tradingName: cleanText(input.tradingName, 240),
    registrationNumber: cleanText(input.registrationNumber, 120),
    vatNumber: cleanText(input.vatNumber, 120),
    physicalAddress: input.physicalAddress ? input.physicalAddress as Prisma.InputJsonValue : undefined,
    supportEmail: cleanText(input.supportEmail, 320),
    businessEmail: cleanText(input.businessEmail, 320),
    telephoneNumbers: input.telephoneNumbers?.map((number) => number.trim().slice(0, 64)).filter(Boolean) as Prisma.InputJsonValue | undefined,
    website: cleanText(input.website, 500),
    publicMetadata: input.publicMetadata ? input.publicMetadata as Prisma.InputJsonValue : undefined,
    documentIdentityMetadata: input.documentIdentityMetadata ? input.documentIdentityMetadata as Prisma.InputJsonValue : undefined,
  };
}

export async function currentCompanyProfile() {
  return prisma.companyProfileVersion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { activatedAt: "desc" },
  });
}

/** Creates the next immutable issuer version and atomically replaces the active version. */
export async function activateCompanyProfile(actorUserId: string, input: CompanyProfileInput) {
  const values = normalized(input);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.companyProfileVersion.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const latest = await tx.companyProfileVersion.aggregate({ _max: { versionNumber: true } });
    const versionNumber = (latest._max.versionNumber ?? 0) + 1;

    if (current) {
      await tx.companyProfileVersion.update({
        where: { id: current.id },
        data: { status: "RETIRED", retiredAt: now },
      });
    }

    return tx.companyProfileVersion.create({
      data: {
        ...values,
        publicReference: reference(versionNumber),
        versionNumber,
        status: "ACTIVE",
        effectiveAt: input.effectiveAt ?? now,
        activatedAt: now,
        activatedByUserId: actorUserId,
        createdByUserId: actorUserId,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/**
 * Captures issuer data once for a formal document. Existing snapshots are never
 * replaced: retrying the same operation returns the original authoritative row.
 */
export async function captureIssuerSnapshot(input: {
  documentType: string;
  documentReference: string;
  companyProfileVersionId?: string;
}) {
  const existing = await prisma.companyIssuerSnapshot.findUnique({
    where: { documentType_documentReference: { documentType: input.documentType, documentReference: input.documentReference } },
  });
  if (existing) return existing;

  const company = input.companyProfileVersionId
    ? await prisma.companyProfileVersion.findUnique({ where: { id: input.companyProfileVersionId } })
    : await currentCompanyProfile();
  if (!company) throw new Error("An active company issuer profile is required before generating formal documents.");

  const issuerSnapshot = {
    publicReference: company.publicReference,
    versionNumber: company.versionNumber,
    legalName: company.legalName,
    tradingName: company.tradingName,
    registrationNumber: company.registrationNumber,
    vatNumber: company.vatNumber,
    physicalAddress: company.physicalAddress,
    supportEmail: company.supportEmail,
    businessEmail: company.businessEmail,
    telephoneNumbers: company.telephoneNumbers,
    website: company.website,
    documentIdentityMetadata: company.documentIdentityMetadata,
  };

  try {
    return await prisma.companyIssuerSnapshot.create({
      data: {
        companyProfileVersionId: company.id,
        documentType: input.documentType.trim().slice(0, 80),
        documentReference: input.documentReference.trim().slice(0, 160),
        issuerSnapshot: issuerSnapshot as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const snapshot = await prisma.companyIssuerSnapshot.findUnique({
        where: { documentType_documentReference: { documentType: input.documentType, documentReference: input.documentReference } },
      });
      if (snapshot) return snapshot;
    }
    throw error;
  }
}
