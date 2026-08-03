import { prisma } from "@/lib/db/prisma";
import { OpeningService } from "@/lib/recruitment/opening.service";

export type PublicCareerOpening = {
  openingReference: string;
  versionReference?: string;
  title: string;
  summary: string;
  track?: string;
  relationshipClassification?: string;
  locationPolicy?: string;
  primaryLocation?: string | null;
  applicationClosesAt?: Date | null;
  noFeeStatement: string;
  accessibilityStatement: string;
};

export type PublicCareerOpeningsSnapshot =
  | { state: "AVAILABLE"; openings: readonly PublicCareerOpening[] }
  | { state: "SOURCE_UNAVAILABLE"; openings: readonly [] };

type RecruitmentPublicOpeningDto = {
  openingReference?: string;
  versionReference?: string;
  title?: string;
  summary?: string;
  track?: string;
  relationshipClassification?: string;
  locationPolicy?: string;
  primaryLocation?: string | null;
  applicationClosesAt?: Date | null;
  noFeeStatement: string;
  accessibilityStatement: string;
};

/** Reads only the recruitment service's existing public DTO, never unpublished records. */
export async function getPublicCareerOpenings(): Promise<PublicCareerOpeningsSnapshot> {
  try {
    const openings = await new OpeningService(prisma).getPublicOpenings() as RecruitmentPublicOpeningDto[];
    const publishedOpenings = openings.flatMap((opening): PublicCareerOpening[] => {
      if (!opening.openingReference || !opening.title || !opening.summary) return [];

      return [{
        openingReference: opening.openingReference,
        versionReference: opening.versionReference,
        title: opening.title,
        summary: opening.summary,
        track: opening.track,
        relationshipClassification: opening.relationshipClassification,
        locationPolicy: opening.locationPolicy,
        primaryLocation: opening.primaryLocation,
        applicationClosesAt: opening.applicationClosesAt ?? null,
        noFeeStatement: opening.noFeeStatement,
        accessibilityStatement: opening.accessibilityStatement,
      }];
    });

    return { state: "AVAILABLE", openings: publishedOpenings };
  } catch {
    return { state: "SOURCE_UNAVAILABLE", openings: [] };
  }
}
