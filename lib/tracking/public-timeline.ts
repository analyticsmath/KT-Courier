import {
  formatSastAndUtc,
  type PublicTrackingMilestone,
  type PublicTrackingStatusProjection,
} from "@/lib/shipment-documents/contracts";

interface StatusHistoryInput {
  status: string;
  createdAt: Date;
}

interface AreaAddressInput {
  city: string | null;
  province: string | null;
  suburb?: string | null;
}

export function formatPublicAreaLabel(
  address: AreaAddressInput | null | undefined,
  fallback: string,
): string {
  if (!address) return fallback;
  const parts = [address.suburb, address.city, address.province]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  // Never reveal street lines or house numbers on unauthenticated status links.
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0];
  return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
}

export function normalizePublicOrderStatusLabel(status: string): {
  label: string;
  tone: PublicTrackingStatusProjection["statusTone"];
} {
  switch (status) {
    case "PENDING":
      return { label: "Booking received", tone: "neutral" };
    case "CONFIRMED":
      return { label: "Confirmed for collection", tone: "information" };
    case "DISPATCHED":
    case "DRIVER_ASSIGNED":
      return { label: "Driver assigned", tone: "information" };
    case "PICKED_UP":
      return { label: "Collected by courier", tone: "information" };
    case "IN_TRANSIT":
      return { label: "In transit", tone: "information" };
    case "DELIVERY_ATTEMPTED":
      return { label: "Delivery attempted", tone: "warning" };
    case "DELIVERED":
    case "COMPLETED":
      return { label: "Delivered", tone: "success" };
    case "DELIVERY_FAILED":
      return { label: "Delivery exception", tone: "danger" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "danger" };
    default:
      return { label: "Status update", tone: "neutral" };
  }
}

export function buildPublicTrackingMilestones(args: {
  currentStatus: string;
  createdAt: Date;
  deliveredAt: Date | null;
  history: readonly StatusHistoryInput[];
}): PublicTrackingMilestone[] {
  const firstAt = (statuses: string[]): Date | null => {
    const match = args.history.find((entry) => statuses.includes(entry.status));
    return match ? match.createdAt : null;
  };

  const toMilestoneTime = (date: Date | null) => ({
    occurredAtIso: date ? date.toISOString() : null,
    occurredAtSast: formatSastAndUtc(date),
  });

  if (args.currentStatus === "CANCELLED") {
    const cancelledAt = firstAt(["CANCELLED"]);
    return [
      {
        key: "BOOKED",
        label: "Booking created",
        description: "Consignment registered with KT Couriers.",
        state: "COMPLETED",
        ...toMilestoneTime(args.createdAt),
      },
      {
        key: "CANCELLED",
        label: "Booking cancelled",
        description: "This delivery booking was cancelled and will not be dispatched.",
        state: "EXCEPTION",
        ...toMilestoneTime(cancelledAt),
      },
    ];
  }

  const stageOrder: Array<{
    key: string;
    label: string;
    description: string;
    statuses: string[];
  }> = [
    {
      key: "BOOKED",
      label: "Booking created",
      description: "Shipment registered in KT Couriers system.",
      statuses: ["PENDING", "CONFIRMED", "DISPATCHED", "DRIVER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED"],
    },
    {
      key: "CONFIRMED",
      label: "Confirmed",
      description: "Order approved and ready for driver dispatch.",
      statuses: ["CONFIRMED", "DISPATCHED", "DRIVER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED"],
    },
    {
      key: "ASSIGNED",
      label: "Driver assigned",
      description: "A verified courier has accepted this consignment.",
      statuses: ["DISPATCHED", "DRIVER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED"],
    },
    {
      key: "COLLECTED",
      label: "Collected & in transit",
      description: "Parcel collected from pickup point and moving to destination.",
      statuses: ["PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED", "DELIVERED", "COMPLETED"],
    },
    {
      key: "DELIVERED",
      label: "Delivered",
      description: "Delivery confirmed by KT Couriers.",
      statuses: ["DELIVERED", "COMPLETED"],
    },
  ];

  const rankByStatus: Record<string, number> = {
    PENDING: 0,
    CONFIRMED: 1,
    DISPATCHED: 2,
    DRIVER_ASSIGNED: 2,
    PICKED_UP: 3,
    IN_TRANSIT: 3,
    DELIVERY_ATTEMPTED: 3,
    DELIVERY_FAILED: 3,
    DELIVERED: 4,
    COMPLETED: 4,
  };

  const currentRank = rankByStatus[args.currentStatus] ?? 0;

  return stageOrder.map((stage, index) => {
    let time = firstAt(stage.statuses);
    if (stage.key === "BOOKED" && !time) time = args.createdAt;
    if (stage.key === "DELIVERED" && args.deliveredAt) time = args.deliveredAt;

    let state: PublicTrackingMilestone["state"] = "UPCOMING";
    if (index < currentRank) {
      state = "COMPLETED";
    } else if (index === currentRank) {
      if (args.currentStatus === "DELIVERY_FAILED" || args.currentStatus === "DELIVERY_ATTEMPTED") {
        state = "EXCEPTION";
      } else if (args.currentStatus === "DELIVERED" || args.currentStatus === "COMPLETED") {
        state = "COMPLETED";
      } else {
        state = "CURRENT";
      }
    }

    return {
      key: stage.key,
      label:
        stage.key === "COLLECTED" && args.currentStatus === "DELIVERY_ATTEMPTED"
          ? "Delivery attempted"
          : stage.key === "COLLECTED" && args.currentStatus === "DELIVERY_FAILED"
            ? "Delivery exception"
            : stage.label,
      description:
        stage.key === "COLLECTED" && args.currentStatus === "DELIVERY_ATTEMPTED"
          ? "A delivery attempt was recorded; re-delivery scheduling applies."
          : stage.key === "COLLECTED" && args.currentStatus === "DELIVERY_FAILED"
            ? "A delivery exception occurred. Contact the sender or KT Couriers support."
            : stage.description,
      state,
      ...toMilestoneTime(time),
    };
  });
}
