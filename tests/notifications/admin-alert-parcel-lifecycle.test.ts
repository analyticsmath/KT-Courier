import { describe, expect, it } from "vitest";
import { SystemSettingType } from "@/types/db";
import {
  ADMIN_ALERT_EVENT_TYPES,
  ADMIN_ALERT_EVENT_LABELS,
  ADMIN_ALERT_EVENT_ADMIN_LINKS,
  activeRecipientsForAdminAlertEvent,
  parseAdminAlertRecipients,
} from "@/lib/settings/admin-alert-recipient-policy";
import { validateSettingValue } from "@/lib/validation/admin-settings";

describe("Admin & SuperAdmin parcel lifecycle notification taxonomy (NTF-01..05)", () => {
  it("covers all required parcel, payment, 24h expiry, fulfilment, and COD events with safe admin paths", () => {
    const required = [
      "PARCEL_ORDER_CREATED",
      "PARCEL_ORDER_PAID",
      "PARCEL_PAYMENT_FAILED",
      "PARCEL_ORDER_ACCEPTED",
      "PARCEL_ORDER_UNPAID_EXPIRED",
      "PARCEL_ORDER_CANCELLED",
      "PARCEL_DRIVER_ASSIGNED",
      "PARCEL_PICKUP_STARTED",
      "PARCEL_PICKED_UP",
      "PARCEL_IN_TRANSIT",
      "PARCEL_DELIVERY_ATTEMPTED",
      "PARCEL_DELIVERED",
      "PARCEL_DELIVERY_FAILED",
      "DRIVER_CASH_DEPOSIT_SUBMITTED",
      "COD_REMITTANCE_RECONCILED",
      "COD_RECONCILIATION_DISCREPANCY",
      "PAYMENT_RECONCILIATION_ALERT",
    ] as const;

    for (const ev of required) {
      expect(ADMIN_ALERT_EVENT_TYPES).toContain(ev);
      expect(ADMIN_ALERT_EVENT_LABELS[ev]?.length).toBeGreaterThan(3);
      expect(ADMIN_ALERT_EVENT_ADMIN_LINKS[ev]).toMatch(/^\/admin\//);
    }
  });

  it("supports separate verified ADMIN and SUPER_ADMIN recipient configurations selectable per event", () => {
    const raw = [
      {
        email: "ops-admin@ktcouriers.co.za",
        label: "Operations Admin",
        active: true,
        roleScope: "ADMIN",
        events: ["PARCEL_ORDER_CREATED", "PARCEL_ORDER_ACCEPTED", "PARCEL_PICKED_UP"],
      },
      {
        email: "superadmin@ktcouriers.co.za",
        label: "SuperAdmin Desk",
        active: true,
        roleScope: "SUPER_ADMIN",
        events: ["PARCEL_ORDER_UNPAID_EXPIRED", "COD_RECONCILIATION_DISCREPANCY", "PAYMENT_RECONCILIATION_ALERT"],
      },
      {
        email: "all-escalations@ktcouriers.co.za",
        label: "Shared Desk",
        active: true,
        roleScope: "ALL",
        events: ["PARCEL_ORDER_UNPAID_EXPIRED"],
      },
    ];

    const check = validateSettingValue(SystemSettingType.JSON, raw, "notifications.admin_alert_recipients");
    expect(check.ok).toBe(true);
    const parsed = parseAdminAlertRecipients(raw)!;
    expect(parsed).toHaveLength(3);

    expect(
      activeRecipientsForAdminAlertEvent(parsed, "PARCEL_ORDER_CREATED", { roleScope: "ADMIN" }).map((r) => r.email),
    ).toEqual(["ops-admin@ktcouriers.co.za"]);

    expect(
      activeRecipientsForAdminAlertEvent(parsed, "PARCEL_ORDER_UNPAID_EXPIRED", { roleScope: "SUPER_ADMIN" }).map((r) => r.email),
    ).toEqual(["superadmin@ktcouriers.co.za", "all-escalations@ktcouriers.co.za"]);

    expect(
      activeRecipientsForAdminAlertEvent(parsed, "PARCEL_ORDER_UNPAID_EXPIRED", { roleScope: "ADMIN" }).map((r) => r.email),
    ).toEqual(["all-escalations@ktcouriers.co.za"]);
  });

  it("rejects invalid roleScope values", () => {
    expect(
      parseAdminAlertRecipients([
        {
          email: "ops@ktcouriers.co.za",
          label: "Ops",
          active: true,
          roleScope: "DRIVER",
          events: ["PARCEL_ORDER_PAID"],
        },
      ]),
    ).toBeNull();
  });
});
