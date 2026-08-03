import { prisma } from "@/lib/db/prisma";
import { OrderOperationalEventType } from "@/types/db";
import type { Prisma } from "@/types/db";
import { toAdminDeliveryExceptionDto, type AdminDeliveryExceptionDto } from "@/lib/dto/delivery.dto";

const EXCEPTION_EVENT_TYPES = [
  OrderOperationalEventType.DELIVERY_ATTEMPTED,
  OrderOperationalEventType.DELIVERY_FAILED,
];

const EXCEPTION_INCLUDE = {
  driverProfile: { select: { driverCode: true, displayName: true } },
  order: {
    select: {
      orderNumber: true,
      status: true,
      deliveryRegion: { select: { name: true } },
    },
  },
} as const;

export interface DeliveryExceptionFilters {
  page: number;
  pageSize: number;
  search?: string;
  driverProfileId?: string;
  eventType?: string;
}

export interface DeliveryExceptionListResult {
  data: AdminDeliveryExceptionDto[];
  total: number;
}

export async function listDeliveryExceptions(
  filters: DeliveryExceptionFilters
): Promise<DeliveryExceptionListResult> {
  const skip = (filters.page - 1) * filters.pageSize;

  const where: Prisma.OrderOperationalEventWhereInput = {
    eventType: { in: EXCEPTION_EVENT_TYPES },
  };

  if (filters.driverProfileId) {
    where.driverProfileId = filters.driverProfileId;
  }

  const asEventType = filters.eventType as OrderOperationalEventType | undefined;
  if (asEventType && (asEventType === OrderOperationalEventType.DELIVERY_ATTEMPTED || asEventType === OrderOperationalEventType.DELIVERY_FAILED)) {
    where.eventType = asEventType;
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { driverProfile: { driverCode: { contains: q, mode: "insensitive" } } },
      { driverProfile: { displayName: { contains: q, mode: "insensitive" } } },
      { publicNote: { contains: q, mode: "insensitive" } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.orderOperationalEvent.findMany({
      where,
      include: EXCEPTION_INCLUDE,
      orderBy: { occurredAt: "desc" },
      skip,
      take: filters.pageSize,
    }),
    prisma.orderOperationalEvent.count({ where }),
  ]);

  return { data: events.map(toAdminDeliveryExceptionDto), total };
}

export async function countUnresolvedDeliveryExceptions(): Promise<number> {
  return prisma.orderOperationalEvent.count({
    where: {
      eventType: { in: EXCEPTION_EVENT_TYPES },
      order: {
        status: { in: ["DELIVERY_ATTEMPTED", "FAILED"] },
      },
    },
  });
}
