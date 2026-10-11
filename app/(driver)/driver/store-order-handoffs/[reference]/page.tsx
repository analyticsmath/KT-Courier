import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { MarketplacePickupForm } from "@/components/driver/MarketplacePickupForm";

export default async function StoreHandoffPage({ params }: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser(); const { reference } = await params;
  if (!user || user.role !== "DRIVER") notFound();
  const bridge = await prisma.marketplaceStoreOrderDeliveryBridge.findFirst({ where: { storeOrder: { publicReference: reference }, courierOrder: { assignments: { some: { status: "ACCEPTED", driverProfile: { userId: user.id, status: "ACTIVE" } } }, currentDriverProfile: { userId: user.id } } }, select: { courierOrder: { select: { parcelCount: true, status: true } } } });
  if (!bridge?.courierOrder) notFound();
  return <div className="space-y-6"><ProtectedPageHeader title="Store pickup" description="Verify the store code and record custody for your assigned delivery." /><MarketplacePickupForm reference={reference} packageCount={bridge.courierOrder.parcelCount} completed={["PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(bridge.courierOrder.status)} /></div>;
}
