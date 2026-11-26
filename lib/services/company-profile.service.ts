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

export class CompanyProfileRequiredError extends Error {
  readonly code = "COMPANY_PROFILE_REQUIRED" as const;
  readonly actionHref = "/admin/company-profile" as const;
  constructor(message = "An active company issuer profile is required before generating formal shipment documents.") {
    super(message);
    this.name = "CompanyProfileRequiredError";
  }
}

export function canonicalizeIssuerDocumentType(documentType: string): string {
  const value = documentType.trim().replace(/\s+/g, "_").toUpperCase().slice(0, 80);
  if (!value) throw new Error("Document type is required to capture issuer snapshot.");
  return value;
}

export function canonicalizeIssuerDocumentReference(documentReference: string): string {
  const value = documentReference.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 160);
  if (!value) throw new Error("Document reference is required to capture issuer snapshot.");
  return value;
}

type CompanyProfileDb = Pick<Prisma.TransactionClient, "companyProfileVersion" | "companyIssuerSnapshot"> & {
  $executeRaw?: Prisma.TransactionClient["$executeRaw"];
};

export async function currentCompanyProfileWithDb(db: Pick<Prisma.TransactionClient, "companyProfileVersion">) {
  return db.companyProfileVersion.findFirst({ where: { status: "ACTIVE" } });
}

export async function captureIssuerSnapshotInTx(
  db: CompanyProfileDb,
  input: {
    documentType: string;
    documentReference: string;
    companyProfileVersionId?: string;
  },
) {
  const documentType = canonicalizeIssuerDocumentType(input.documentType);
  const documentReference = canonicalizeIssuerDocumentReference(input.documentReference);

  const existing = await db.companyIssuerSnapshot.findUnique({
    where: { documentType_documentReference: { documentType, documentReference } },
  });
  if (existing) return existing;

  const company = input.companyProfileVersionId
    ? await db.companyProfileVersion.findUnique({ where: { id: input.companyProfileVersionId } })
    : await currentCompanyProfileWithDb(db);
  if (!company) {
    throw new CompanyProfileRequiredError();
  }

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

  if (typeof db.$executeRaw === "function" && db !== prisma) {
    await db.$executeRaw`SAVEPOINT kt_capture_issuer_snapshot`;
    try {
      const created = await db.companyIssuerSnapshot.create({
        data: {
          companyProfileVersionId: company.id,
          documentType,
          documentReference,
          issuerSnapshot: issuerSnapshot as Prisma.InputJsonValue,
        },
      });
      await db.$executeRaw`RELEASE SAVEPOINT kt_capture_issuer_snapshot`;
      return created;
    } catch (error) {
      await db.$executeRaw`ROLLBACK TO SAVEPOINT kt_capture_issuer_snapshot`;
      await db.$executeRaw`RELEASE SAVEPOINT kt_capture_issuer_snapshot`;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const snapshot = await db.companyIssuerSnapshot.findUnique({
          where: { documentType_documentReference: { documentType, documentReference } },
        });
        if (snapshot) return snapshot;
      }
      throw error;
    }
  }

  try {
    return await db.companyIssuerSnapshot.create({
      data: {
        companyProfileVersionId: company.id,
        documentType,
        documentReference,
        issuerSnapshot: issuerSnapshot as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const snapshot = await db.companyIssuerSnapshot.findUnique({
        where: { documentType_documentReference: { documentType, documentReference } },
      });
      if (snapshot) return snapshot;
    }
    throw error;
  }
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
  return captureIssuerSnapshotInTx(prisma, input);
}
