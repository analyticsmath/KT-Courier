/* eslint-disable @typescript-eslint/no-explicit-any -- marketplace delegates are runtime-gated until Prisma generation is approved. */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreFulfilmentDetail } from "@/components/protected-v2/store/StoreFulfilmentDetail";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export default async function MarketplaceStoreOrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const { reference } = await params;
  const order = await (prisma as any).marketplaceStoreOrder.findFirst({
    where: { publicReference: reference, store: { ownerUserId: user.id } },
    include: {
      lines: { include: { fulfilment: true, issues: { orderBy: { createdAt: "asc" } } } },
      history: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Marketplace fulfilment" title={order.publicReference} description="Store-safe operational detail. Customer payment, courier dispatch, and driver-private data are not exposed here." actions={<Link className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-3 text-sm font-semibold text-[var(--eo-text)]" href="/store/orders">Back to orders</Link>} />
    <StoreFulfilmentDetail order={{
      reference: order.publicReference,
      acceptanceStatus: order.acceptanceStatus,
      preparationStatus: order.preparationStatus,
      resolutionStatus: order.resolutionStatus,
      reviewDeadlineAt: order.reviewDeadlineAt,
      lines: order.lines.map((line: any) => ({ id: line.id, title: line.title, variantTitle: line.variantTitle, quantity: line.quantity, fulfilmentStatus: line.fulfilment?.status ?? null, confirmedAvailableQuantity: line.fulfilment?.confirmedAvailableQuantity ?? null, issues: line.issues.map((issue: any) => ({ id: issue.id, issueType: issue.issueType, affectedQuantity: issue.affectedQuantity })) })),
      history: order.history.map((event: any) => ({ id: event.id, eventType: event.eventType, createdAt: event.createdAt })),
    }} />
  </ProtectedPageFrame>;
}
