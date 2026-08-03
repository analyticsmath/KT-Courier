import { createHash } from "node:crypto";
import { CatalogNotFoundError, CatalogPolicyError } from "@/lib/catalog/errors";
import { assertCatalogMediaProductionActionAllowed, type InjectedCatalogMediaTestApproval } from "@/lib/catalog/media/catalog-media-production-lock";
import { type CatalogMediaStorageAdapter } from "@/lib/catalog/media/catalog-media-storage-adapter";

export type CatalogMediaDeliveryEvidence = Readonly<{
  publicReference: string;
  storageKey: string;
  status: string;
  mimeType: string | null;
  byteSize: number | null;
  checksum: string | null;
  privacyInspectionPassed: boolean;
  associationRole: string;
  productPublicationStatus: string;
  snapshotStatus: string;
}>;

export function assertCatalogMediaPublicDeliveryEvidence(evidence: CatalogMediaDeliveryEvidence): void {
  if (evidence.status !== "READY" || !evidence.mimeType || !evidence.byteSize || !evidence.checksum || !evidence.privacyInspectionPassed) throw new CatalogNotFoundError("Public catalog media is unavailable.");
  if (evidence.associationRole === "COMPLIANCE_DOCUMENT") throw new CatalogNotFoundError("Compliance media is private.");
  if (evidence.productPublicationStatus !== "PUBLISHED" || evidence.snapshotStatus !== "PUBLISHED") throw new CatalogNotFoundError("Public catalog media lacks publication evidence.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(evidence.mimeType)) throw new CatalogPolicyError("CATALOG_MEDIA_DELIVERY_TYPE_INVALID", "Catalog media content type is not safe for inline delivery.");
}

export interface CatalogMediaDeliveryRepository {
  findPublicEvidence(publicReference: string): Promise<CatalogMediaDeliveryEvidence | null>;
}

export class CatalogMediaDeliveryService {
  constructor(private readonly repository: CatalogMediaDeliveryRepository, private readonly storage: CatalogMediaStorageAdapter, private readonly testApproval?: InjectedCatalogMediaTestApproval) {}

  async deliver(publicReference: string) {
    assertCatalogMediaProductionActionAllowed("PUBLIC_DELIVERY", this.testApproval);
    const evidence = await this.repository.findPublicEvidence(publicReference);
    if (!evidence) throw new CatalogNotFoundError("Public catalog media is unavailable.");
    assertCatalogMediaPublicDeliveryEvidence(evidence);
    const target = await this.storage.createReadTarget({ storageKey: evidence.storageKey, maximumBytes: evidence.byteSize ?? 0 });
    if (target.byteSize !== evidence.byteSize) throw new CatalogPolicyError("CATALOG_MEDIA_DELIVERY_SIZE_MISMATCH", "Stored media no longer matches publication evidence.", 409);
    if (createHash("sha256").update(target.body).digest("hex") !== evidence.checksum) throw new CatalogPolicyError("CATALOG_MEDIA_DELIVERY_CHECKSUM_MISMATCH", "Stored media no longer matches its immutable checksum evidence.", 409);
    const extension = evidence.mimeType === "image/jpeg" ? "jpg" : evidence.mimeType === "image/png" ? "png" : "webp";
    return {
      body: target.body,
      headers: {
        "Content-Type": evidence.mimeType,
        "Content-Length": String(target.byteSize),
        "Content-Disposition": `inline; filename="catalog-media.${extension}"`,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    };
  }
}
