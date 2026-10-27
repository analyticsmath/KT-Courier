/** Snapshot of the current state of orders created in the selected period. */
export function summariseOrderCohort(
  rows: readonly { status: string; _count: { _all: number } }[],
) {
  const total = rows.reduce((n, row) => n + row._count._all, 0);
  const count = (states: readonly string[]) =>
    rows
      .filter((row) => states.includes(row.status))
      .reduce((n, row) => n + row._count._all, 0);
  const delivered = count(["DELIVERED", "COMPLETED"]);
  const active = count([
    "CONFIRMED",
    "PICKUP_SCHEDULED",
    "PICKED_UP",
    "IN_TRANSIT",
    "IN_PROGRESS",
  ]);
  const attention = count(["PENDING", "FAILED", "DELIVERY_ATTEMPTED"]);
  return {
    total,
    delivered,
    active,
    attention,
    other: total - delivered - active - attention,
    deliveredShare: total ? (delivered / total) * 100 : null,
  };
}

export function summariseDriverAssignments(
  rows: readonly { status: string; orderStatus: string }[],
) {
  const completed = rows.filter((row) => row.status === "COMPLETED").length;
  const offers = rows.filter((row) => row.status === "ASSIGNED").length;
  const active = rows.filter(
    (row) =>
      row.status === "ACCEPTED" &&
      !["DELIVERED", "COMPLETED", "CANCELLED", "FAILED"].includes(
        row.orderStatus,
      ),
  ).length;
  return {
    total: rows.length,
    completed,
    offers,
    active,
    other: rows.length - completed - offers - active,
  };
}
