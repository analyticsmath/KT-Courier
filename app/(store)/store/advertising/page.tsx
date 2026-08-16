import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { prisma } from "@/lib/db/prisma";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import {
  StoreAdvertisingWorkbench,
  MarketingPackageItem,
  MarketingRequestItem,
  EntitledStoreMediaItem,
} from "@/components/store/StoreAdvertisingWorkbench";

export const metadata: Metadata = {
  title: "Store advertising & campaigns",
  description: "Request, schedule, and track on-platform marketing and partner advertising campaigns.",
};

const service = new ManagedMarketingService();

export default async function StoreAdvertisingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const store = await getStoreForUser(user.id);
  const storeName = store?.name || "Merchant Store";

  let initialPackages: MarketingPackageItem[] = [];
  let initialRequests: MarketingRequestItem[] = [];
  let entitledMedia: EntitledStoreMediaItem[] = [];
  let backendError: string | null = null;

  try {
    const rawPackages = (await service.listPackages()) as Array<{
      id: string;
      publicReference: string;
      code: string;
      name: string;
      description: string | null;
      channel: string;
      durationDays: number | null;
      postCount?: number;
      videoCount?: number;
      storyCount?: number;
      priceAmount: unknown;
      taxRate: unknown;
      currency?: string;
      status: string;
      channels?: Array<{
        channelDefinition: {
          id: string;
          publicReference: string;
          code: string;
          displayName: string;
          placements?: Array<{
            id: string;
            publicReference: string;
            code: string;
            displayName: string;
            kind: string;
          }>;
        };
      }>;
    }>;

    initialPackages = (rawPackages || []).map((p) => ({
      id: p.id,
      publicReference: p.publicReference,
      code: p.code,
      name: p.name,
      description: p.description ?? null,
      channel: p.channel,
      durationDays: p.durationDays ?? null,
      postCount: p.postCount || 0,
      videoCount: p.videoCount || 0,
      storyCount: p.storyCount || 0,
      priceAmount: String(p.priceAmount || "0.00"),
      taxRate: String(p.taxRate || "0.00"),
      currency: p.currency || "ZAR",
      status: p.status,
      channels: p.channels?.map((c) => ({
        id: c.channelDefinition.id,
        publicReference: c.channelDefinition.publicReference,
        code: c.channelDefinition.code,
        displayName: c.channelDefinition.displayName,
        channel: p.channel,
        placements: c.channelDefinition.placements?.map((pl) => ({
          id: pl.id,
          publicReference: pl.publicReference,
          code: pl.code,
          displayName: pl.displayName,
          kind: pl.kind,
        })),
      })),
    }));
  } catch (err: unknown) {
    backendError = err instanceof Error ? err.message : "Failed to load marketing packages";
    initialPackages = [];
  }

  try {
    if (store) {
      // Query entitled store private media (must belong to store, active, and uploaded by requesting actor)
      const rawMedia = await prisma.privateMediaObject.findMany({
        where: {
          ownerType: "STORE",
          ownerId: store.id,
          createdByUserId: user.id,
          status: { in: ["READY", "RETAINED"] },
          deletedAt: null,
        },
        select: {
          id: true,
          publicReference: true,
          originalFileName: true,
          detectedMimeType: true,
          purpose: true,
        },
        orderBy: { createdAt: "desc" },
      });

      entitledMedia = rawMedia.map((m) => ({
        id: m.id,
        publicReference: m.publicReference,
        fileName: m.originalFileName,
        mimeType: m.detectedMimeType || "image/jpeg",
        purpose: m.purpose,
      }));

      const rawRequests = (await service.listOwnRequests({
        actorUserId: user.id,
        actorRole: user.role,
      })) as Array<{
        id: string;
        publicReference: string;
        objective: string;
        message: string;
        instructions?: string | null;
        status: string;
        executionMode: string;
        commercial?: {
          baseAmount: string;
          taxRate: string;
          taxAmount: string;
          grossAmount: string;
          currency: string;
        } | null;
        priceSnapshot?: unknown;
        taxSnapshot?: unknown;
        currency?: string;
        startsAt: Date | string;
        endsAt: Date | string;
        createdAt: Date | string;
        packageVersion?: { name: string; code: string } | null;
        creatives?: Array<{
          id: string;
          publicReference: string;
          source: string;
          role: string;
          createdAt: Date | string;
          privateMediaObject?: { publicReference: string } | null;
          catalogMediaAsset?: { publicReference: string } | null;
        }>;
        performanceRecords?: Array<{
          impressions: number;
          clicks: number;
          conversions: number;
          spendAmount: unknown;
        }>;
      }>;

      initialRequests = (rawRequests || []).map((r) => {
        const perf = r.performanceRecords?.[0];
        const baseAmount = r.commercial?.baseAmount || (r.priceSnapshot != null ? String(r.priceSnapshot) : "0.00");
        const taxAmount = r.commercial?.taxAmount || "0.00";
        const grossAmount = r.commercial?.grossAmount || baseAmount;
        const currency = r.commercial?.currency || r.currency || "ZAR";

        return {
          id: r.id,
          publicReference: r.publicReference,
          objective: r.objective,
          message: r.message,
          instructions: r.instructions ?? null,
          status: r.status,
          executionMode: r.executionMode,
          priceAmount: baseAmount,
          taxAmount: taxAmount,
          totalAmount: grossAmount,
          currency,
          startAt: r.startsAt ? (typeof r.startsAt === "string" ? r.startsAt : r.startsAt.toISOString()) : null,
          endAt: r.endsAt ? (typeof r.endsAt === "string" ? r.endsAt : r.endsAt.toISOString()) : null,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString(),
          packageVersion: r.packageVersion ? { name: r.packageVersion.name, code: r.packageVersion.code } : null,
          creatives: (r.creatives || []).map((c) => ({
            id: c.id,
            publicReference: c.publicReference,
            source: c.source,
            role: c.role || "CREATIVE",
            mediaReference: c.privateMediaObject?.publicReference || c.catalogMediaAsset?.publicReference || c.publicReference,
            createdAt: typeof c.createdAt === "string" ? c.createdAt : (c.createdAt?.toISOString?.() || new Date().toISOString()),
          })),
          performanceRecord: perf ? {
            impressions: perf.impressions,
            clicks: perf.clicks,
            spendAmount: perf.spendAmount != null ? String(perf.spendAmount) : "0.00",
          } : null,
        };
      });
    }
  } catch (err: unknown) {
    if (!backendError) {
      backendError = err instanceof Error ? err.message : "Failed to load store requests";
    }
    initialRequests = [];
  }

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Merchant Growth"
        title="Store advertising & campaigns"
        description="Launch governed promotional campaigns, schedule cross-channel placements, and analyze reach and engagement."
      />
      <StoreAdvertisingWorkbench
        initialPackages={initialPackages}
        initialRequests={initialRequests}
        entitledMedia={entitledMedia}
        storeName={storeName}
        backendError={backendError}
      />
    </ProtectedPageFrame>
  );
}
