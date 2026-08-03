import { prisma } from "@/lib/db/prisma";
import { detectDuplicateSignals } from "@/lib/catalog/catalog-duplicate-detection";
import { CatalogNotFoundError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";

export async function searchCatalogDuplicates(input: { title: string; productTypeCode: string; gtin?: string; brandId?: string; mpn?: string }) {
  const candidates = await prisma.catalogProduct.findMany({
    where: { productTypeDefinition: { code: input.productTypeCode }, OR: [{ normalizedTitle: input.title.toLocaleLowerCase("en-ZA") }, ...(input.gtin ? [{ variants: { some: { gtin: input.gtin.replace(/[\s-]/g, "") } } }] : [])] },
    include: { productTypeDefinition: { select: { code: true } }, variants: { select: { gtin: true, mpn: true, optionFingerprint: true } } },
    take: 20,
  });
  return detectDuplicateSignals({ productId: "source", title: input.title, productTypeCode: input.productTypeCode, brandId: input.brandId, gtins: input.gtin ? [input.gtin] : [], mpns: input.mpn ? [input.mpn] : [] }, candidates.map((candidate) => ({ productId: candidate.id, title: candidate.title, productTypeCode: candidate.productTypeDefinition.code, brandId: candidate.brandId, gtins: candidate.variants.flatMap((variant) => variant.gtin ? [variant.gtin] : []), mpns: candidate.variants.flatMap((variant) => variant.mpn ? [variant.mpn] : []), variantFingerprints: candidate.variants.map((variant) => variant.optionFingerprint) })));
}

export async function listCatalogDuplicateCandidates() {
  return prisma.catalogDuplicateCandidate.findMany({ where: { status: "OPEN" }, include: { sourceProduct: { select: { publicReference: true, title: true } }, candidateProduct: { select: { publicReference: true, title: true } } }, orderBy: [{ confidenceBand: "desc" }, { createdAt: "asc" }] });
}

export async function resolveCatalogDuplicate(id: string, actorUserId: string, action: "CONFIRM_DISTINCT" | "REJECT_SOURCE" | "LINK_TO_EXISTING" | "REQUEST_MERGE_REVIEW", operationId: string) {
  const candidate = await prisma.catalogDuplicateCandidate.findUnique({ where: { id } });
  if (!candidate) throw new CatalogNotFoundError("Duplicate candidate was not found.");
  const status = { CONFIRM_DISTINCT: "CONFIRMED_DISTINCT", REJECT_SOURCE: "SOURCE_REJECTED", LINK_TO_EXISTING: "LINKED_TO_EXISTING", REQUEST_MERGE_REVIEW: "MERGE_REVIEW_REQUESTED" }[action] as never;
  return prisma.$transaction(async (tx) => {
    const resolved = await tx.catalogDuplicateCandidate.update({ where: { id }, data: { status, reviewedByUserId: actorUserId, resolvedAt: new Date() } });
    await recordCatalogEvidence(tx, { aggregateType: "MODERATION", aggregateReference: id, aggregateVersion: 1, action: `DUPLICATE_${action}`, eventType: "MODERATION_RECORDED", actorUserId, operation: { operationId, request: { id, action } } });
    return resolved;
  });
}
