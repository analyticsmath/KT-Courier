export type PublicAssetApprovalStatus =
  | "RESEARCH_ONLY"
  | "LICENCE_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "RETIRED";

export type PublicAssetReleaseStatus = "UNRELEASED" | "RELEASED" | "EXPIRED";

export type PublicAssetDerivative = {
  format: "avif" | "webp" | "png" | "jpg" | "jpeg";
  width: number;
  height: number;
  path: `/${string}`;
  mediaQuery?: string;
  usage?: string;
  transparent: boolean;
  byteSize?: number;
};

export type PublicAssetFocalPoint = {
  x: number;
  y: number;
};

export type PublicAssetRecord = {
  id: string;
  sourcePlatform: string;
  sourceUrl: string;
  creator: string;
  licenceType: string;
  licenceDocumentPath: string;
  acquiredAt: string;
  originalFilename: string;
  originalWidth: number;
  originalHeight: number;
  originalHash: string;
  releaseStatus: PublicAssetReleaseStatus;
  permittedUses: readonly string[];
  pageUsages: readonly string[];
  altIntent: string;
  focalPoint: PublicAssetFocalPoint;
  colourTreatment: string;
  derivatives: readonly PublicAssetDerivative[];
  approvalStatus: PublicAssetApprovalStatus;
};

/**
 * Production imagery enters this manifest only after acquisition and approval.
 * R1 intentionally contains no records and therefore makes no asset claims.
 */
export const publicAssetManifest = [] as const satisfies readonly PublicAssetRecord[];
