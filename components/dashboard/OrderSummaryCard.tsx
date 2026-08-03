import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { formatRelativeDate } from "@/lib/utils/formatters";
import { getDeliveryTypeConfig } from "@/lib/constants/statuses";
import type { OrderSummaryDto } from "@/lib/dto/order.dto";

interface OrderSummaryCardProps {
  order: OrderSummaryDto;
  href?: string;
}

export function OrderSummaryCard({ order, href }: OrderSummaryCardProps) {
  const pickupLabel = order.pickupContactName ?? order.pickupSummary;
  const dropoffLabel = order.dropoffContactName ?? order.dropoffSummary;
  const deliveryTypeLabel = getDeliveryTypeConfig(order.deliveryType).label;

  const content = (
    <Card
      padding="md"
      className="hover:border-[--kt-border-strong] hover:shadow-md transition-all duration-150 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold text-[--kt-text-muted] mb-0.5">{deliveryTypeLabel}</p>
          <p className="font-bold text-[--kt-text] font-mono text-sm">{order.orderNumber}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[--kt-brand-blue] flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-[--kt-text-soft] truncate">{pickupLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[--kt-green] flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-[--kt-text-soft] truncate">{dropoffLabel}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-[--kt-text-muted]">
        <span>{formatRelativeDate(order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt))}</span>
        {order.priceEstimate !== null && order.priceEstimate !== undefined && (
          <span className="font-medium text-[--kt-text-soft]">
            {order.currency} {order.priceEstimate.toFixed(2)}
          </span>
        )}
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}
