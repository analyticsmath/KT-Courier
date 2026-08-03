// PLACEHOLDER DATA — frontend layout only, not real operational data
// Status values use Phase 1 DB enum keys (uppercase)
import type { Order } from "@/types/order";

export const MOCK_ORDERS: Order[] = [
  {
    id: "ord-1024",
    orderNumber: "KT-2026-001024",
    status: "IN_PROGRESS",
    paymentStatus: "unpaid",
    deliveryType: "SAME_DAY",
    pickup: {
      name: "Green Grocer Store",
      phone: "07700 900001",
      line1: "12 Market Street",
      city: "Cape Town",
      postcode: "8001",
    },
    dropoff: {
      name: "Sarah Johnson",
      phone: "07700 900002",
      line1: "45 Oak Avenue",
      city: "Cape Town",
      postcode: "7700",
    },
    parcelDescription: "Grocery box",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    timeline: [
      { status: "PENDING", label: "Order submitted", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "CONFIRMED", label: "Order confirmed", timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(), completed: true },
      { status: "IN_PROGRESS", label: "In progress", timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), completed: false, current: true },
      { status: "COMPLETED", label: "Completed", timestamp: "", completed: false },
    ],
  },
  {
    id: "ord-1023",
    orderNumber: "KT-2026-001023",
    status: "COMPLETED",
    paymentStatus: "paid",
    deliveryType: "SAME_DAY",
    pickup: {
      name: "City Pharmacy",
      phone: "07700 900003",
      line1: "88 High Street",
      city: "Cape Town",
      postcode: "8001",
    },
    dropoff: {
      name: "Tom Whitfield",
      phone: "07700 900004",
      line1: "9 Birch Close",
      city: "Bellville",
      postcode: "7530",
    },
    parcelDescription: "Prescription package",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    timeline: [
      { status: "PENDING", label: "Order submitted", timestamp: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "CONFIRMED", label: "Order confirmed", timestamp: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "IN_PROGRESS", label: "In progress", timestamp: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "COMPLETED", label: "Completed", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), completed: true },
    ],
  },
  {
    id: "ord-1022",
    orderNumber: "KT-2026-001022",
    status: "PENDING",
    paymentStatus: "unpaid",
    deliveryType: "SCHEDULED",
    pickup: {
      name: "The Print Shop",
      phone: "07700 900005",
      line1: "3 Commerce Way",
      city: "Cape Town",
      postcode: "8001",
    },
    dropoff: {
      name: "Bright Agency Ltd",
      phone: "07700 900006",
      line1: "Suite 10, Central House",
      city: "Cape Town",
      postcode: "8001",
    },
    parcelDescription: "Print materials",
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    timeline: [
      { status: "PENDING", label: "Order submitted", timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), completed: true },
      { status: "CONFIRMED", label: "Order confirmed", timestamp: "", completed: false, current: true },
      { status: "IN_PROGRESS", label: "In progress", timestamp: "", completed: false },
      { status: "COMPLETED", label: "Completed", timestamp: "", completed: false },
    ],
  },
];

export const MOCK_ADMIN_STATS = {
  newRequests: 12,
  awaitingAssignment: 5,
  inTransit: 8,
  deliveredToday: 23,
  needsAttention: 2,
  activeStores: 14,
};

export const MOCK_STORE_STATS = {
  ordersToday: 6,
  awaitingPickup: 2,
  inTransit: 3,
  deliveredThisWeek: 31,
};

export const MOCK_CUSTOMER_STATS = {
  activeDeliveries: 1,
  pendingRequests: 1,
  completedDeliveries: 8,
};

export const MOCK_USERS = [
  { id: "u-001", name: "Sarah Johnson", email: "sarah@example.com", role: "customer", status: "active", createdAt: "2025-03-12" },
  { id: "u-002", name: "Tom Whitfield", email: "tom@example.com", role: "customer", status: "active", createdAt: "2025-04-01" },
  { id: "u-003", name: "Green Grocer Store", email: "admin@greengrocer.com", role: "store", status: "active", createdAt: "2025-02-10" },
];

export const MOCK_STORES = [
  { id: "s-001", name: "Green Grocer Store", contact: "Ben Green", email: "admin@greengrocer.com", ordersThisWeek: 18, status: "active" },
  { id: "s-002", name: "City Pharmacy", contact: "Aisha Patel", email: "orders@citypharmacy.com", ordersThisWeek: 12, status: "active" },
  { id: "s-003", name: "The Print Shop", contact: "Marco Rossi", email: "marco@printshop.com", ordersThisWeek: 5, status: "active" },
];

export const MOCK_DRIVERS = [
  { id: "d-001", name: "James Driver", phone: "07700 910001", status: "active", activeOrders: 1 },
  { id: "d-002", name: "Lisa Chen", phone: "07700 910002", status: "active", activeOrders: 2 },
  { id: "d-003", name: "Kwame Osei", phone: "07700 910003", status: "available", activeOrders: 0 },
];
