import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStoreForUser } from "@/lib/auth/store-context";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { UserRole } from "@prisma/client";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreAdvertisingWorkbench, MarketingPackageItem, MarketingRequestItem } from "@/components/store/StoreAdvertisingWorkbench";

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

  try {
    const rawPackages = (await service.listPackages()) as Array<{
      id: string;
      publicReference: string;
      code: string;
      name: string;
      description: string;
      channel: string;
      durationDays: number;
      postCount?: number;
      videoCount?: number;
      storyCount?: number;
      priceAmount?: unknown;
      taxRate?: unknown;
      currency?: string;
      status: string;
    }>;
    initialPackages = (rawPackages || []).map((p) => ({
      id: p.id,
      publicReference: p.publicReference,
      code: p.code,
      name: p.name,
      description: p.description,
      channel: p.channel,
      durationDays: p.durationDays,
      postCount: p.postCount || 0,
      videoCount: p.videoCount || 0,
      storyCount: p.storyCount || 0,
      priceAmount: String(p.priceAmount || "1500.00"),
      taxRate: String(p.taxRate || "0.15"),
      currency: p.currency || "ZAR",
      status: p.status,
    }));
  } catch {
    initialPackages = [
      {
        id: "pkg-std",
        publicReference: "MMP-STD-01",
        code: "STANDARD_GROWTH",
        name: "Standard Growth Package",
        description: "Multi-channel advertising distribution across top South African digital networks.",
        channel: "FACEBOOK",
        durationDays: 14,
        postCount: 4,
        videoCount: 2,
        storyCount: 6,
        priceAmount: "1500.00",
        taxRate: "0.15",
        currency: "ZAR",
        status: "ACTIVE",
      },
      {
        id: "pkg-prm",
        publicReference: "MMP-PRM-01",
        code: "PREMIUM_REACH",
        name: "Premium Nationwide Reach",
        description: "Priority featured carousel placement and targeted social video promotion.",
        channel: "TIKTOK",
        durationDays: 30,
        postCount: 8,
        videoCount: 4,
        storyCount: 12,
        priceAmount: "3500.00",
        taxRate: "0.15",
        currency: "ZAR",
        status: "ACTIVE",
      },
    ];
  }

  try {
    if (store) {
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
        priceAmount?: unknown;
        taxAmount?: unknown;
        totalAmount?: unknown;
        currency?: string;
        startsAt: Date | string;
        endsAt: Date | string;
        createdAt: Date | string;
      }>;
      initialRequests = (rawRequests || []).map((r) => ({
        id: r.id,
        publicReference: r.publicReference,
        objective: r.objective,
        message: r.message,
        instructions: r.instructions ?? null,
        status: r.status,
        executionMode: r.executionMode,
        priceAmount: String(r.priceAmount || "0"),
        taxAmount: String(r.taxAmount || "0"),
        totalAmount: String(r.totalAmount || "0"),
        currency: r.currency || "ZAR",
        startAt: r.startsAt ? (typeof r.startsAt === "string" ? r.startsAt : r.startsAt.toISOString()) : null,
        endAt: r.endsAt ? (typeof r.endsAt === "string" ? r.endsAt : r.endsAt.toISOString()) : null,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString(),
      }));
    }
  } catch {
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
        storeName={storeName}
      />
    </ProtectedPageFrame>
  );
}
