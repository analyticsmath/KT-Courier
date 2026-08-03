"use client";

import { useState } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { OrderSummaryCard } from "@/components/dashboard/OrderSummaryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OrderSummaryDto } from "@/lib/dto/order.dto";

const FILTERS = [
  { value: "all", label: "All orders" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
];

interface OrdersListViewProps {
  orders: OrderSummaryDto[];
  orderHref?: (id: string) => string;
  emptyAction?: { label: string; href: string };
}

export function OrdersListView({ orders, orderHref, emptyAction }: OrdersListViewProps) {
  const [filter, setFilter] = useState("all");

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    if (filter === "active") {
      return ["CONFIRMED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "IN_PROGRESS", "DELIVERY_ATTEMPTED"].includes(o.status);
    }
    if (filter === "pending") return o.status === "PENDING" || o.status === "DRAFT";
    if (filter === "completed") return o.status === "DELIVERED" || o.status === "COMPLETED";
    return true;
  });

  return (
    <div className="space-y-4">
      <FilterBar filters={FILTERS} active={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <EmptyState
          title="No deliveries found"
          description={filter === "all" ? "No delivery requests yet." : "No orders match this filter."}
          action={filter === "all" ? emptyAction : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((order) => (
            <OrderSummaryCard
              key={order.id}
              order={order}
              href={orderHref?.(order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
