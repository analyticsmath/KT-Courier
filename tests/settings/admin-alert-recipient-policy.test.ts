import { describe, expect, it } from "vitest";
import { SystemSettingType } from "@/types/db";
import {
  activeRecipientsForAdminAlertEvent,
  isValidConfiguredNotificationEmail,
  parseAdminAlertRecipients,
} from "@/lib/settings/admin-alert-recipient-policy";
import { validateSettingValue } from "@/lib/validation/admin-settings";

describe("admin notification recipient policy and placeholder rejection (P1-A30)", () => {
  it("rejects literal client placeholders [add business email], [add owner email], and malformed addresses", () => {
    for (const invalid of [
      "[add business email]",
      "[add owner email]",
      "add business email",
      "add owner email",
      "ops@[add business email].co.za",
      "owner@example.invalid",
      "support@example.com",
      "not-an-email",
      "",
    ]) {
      expect(isValidConfiguredNotificationEmail(invalid)).toBe(false);
      expect(
        validateSettingValue(
          SystemSettingType.STRING,
          invalid,
          "platform.contact_email",
        ).ok,
      ).toBe(false);
      expect(
        validateSettingValue(
          SystemSettingType.JSON,
          [
            {
              email: invalid,
              label: "Operations",
              active: true,
              events: ["PARCEL_ORDER_PAID"],
            },
          ],
          "notifications.admin_alert_recipients",
        ).ok,
      ).toBe(false);
    }
  });

  it("validates and filters multi-recipient event subscriptions", () => {
    const raw = [
      {
        email: "Dispatch@KTCouriers.co.za",
        label: "Dispatch Desk",
        active: true,
        events: ["PARCEL_ORDER_PAID", "MARKETPLACE_ORDER_PAID"],
      },
      {
        email: "compliance@ktcouriers.co.za",
        label: "Store Compliance",
        active: true,
        events: ["STORE_READINESS_BLOCKER"],
      },
      {
        email: "paused@ktcouriers.co.za",
        label: "Paused Recipient",
        active: false,
        events: ["PARCEL_ORDER_PAID"],
      },
    ];
    const validated = validateSettingValue(
      SystemSettingType.JSON,
      raw,
      "notifications.admin_alert_recipients",
    );
    expect(validated.ok).toBe(true);
    const parsed = parseAdminAlertRecipients(raw)!;
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.email).toBe("dispatch@ktcouriers.co.za");
    expect(
      activeRecipientsForAdminAlertEvent(parsed, "PARCEL_ORDER_PAID").map(
        (r) => r.email,
      ),
    ).toEqual(["dispatch@ktcouriers.co.za"]);
    expect(
      activeRecipientsForAdminAlertEvent(
        parsed,
        "STORE_READINESS_BLOCKER",
      ).map((r) => r.email),
    ).toEqual(["compliance@ktcouriers.co.za"]);
  });

  it("rejects duplicate recipient emails and empty event subscriptions", () => {
    expect(
      parseAdminAlertRecipients([
        {
          email: "ops@ktcouriers.co.za",
          label: "Ops 1",
          active: true,
          events: ["PARCEL_ORDER_PAID"],
        },
        {
          email: "OPS@ktcouriers.co.za",
          label: "Ops 2",
          active: true,
          events: ["MARKETPLACE_ORDER_PAID"],
        },
      ]),
    ).toBeNull();
    expect(
      parseAdminAlertRecipients([
        {
          email: "ops@ktcouriers.co.za",
          label: "Ops 1",
          active: true,
          events: [],
        },
      ]),
    ).toBeNull();
  });
});
