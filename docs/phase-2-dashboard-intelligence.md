# Phase 2.3 Dashboard Intelligence

Dashboards now prioritize real operational data. No fake analytics, revenue, driver metrics, or live tracking are introduced.

## Customer Dashboard

- Shows a primary request-delivery action.
- Highlights the latest active customer order, including status copy, pickup/dropoff summaries, and route distance when available.
- Shows saved address count and the current default saved address if one exists.
- Shows recent orders with status badges and "Create similar" actions.
- Uses polished empty states when no orders or saved addresses exist.

## Store Dashboard

- Shows store name and account status.
- Shows real operation counts:
  - Active orders
  - Requested orders
  - Scheduled pickups
  - In transit orders
  - Delivered orders, including legacy `COMPLETED`
  - Orders with route data
- Groups active orders by lifecycle status.
- Shows default pickup address and whether a coordinate-backed location is captured.
- Links recent orders to the repeat delivery workflow.

## Admin Dashboard

Admin operational KPIs are real database counts:

- Total orders
- Requested orders
- Active orders
- Delivered orders, including legacy `COMPLETED`
- Failed orders
- Orders with route data
- Orders missing route data
- Active delivery regions
- Pending contact messages
- Store count
- Customer count

## Route Coverage KPI

Route coverage percentage is:

`ordersWithRoute / totalOrders * 100`

An order is counted as route-backed when `distanceMeters` is not null. Average distance is calculated from orders that have `distanceMeters`.

## Orders Needing Attention

The admin attention queue is bounded and includes:

- `PENDING`
- `DELIVERY_ATTEMPTED`
- `FAILED`
- active orders missing route data

## Repeat Delivery Foundation

The repeat flow is prefill only:

- `/account/request-delivery?repeatFrom=ORDER_ID`
- `/store/new-delivery?repeatFrom=ORDER_ID`

Ownership is checked before prefill data is returned. The new order does not copy status, status history, route snapshots, or delivery region snapshots. Route and price are recalculated through the normal order creation path.
