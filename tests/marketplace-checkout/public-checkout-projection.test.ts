import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { projectPublicCheckout } from "@/lib/marketplace-checkout/checkout.service";

describe("public checkout money projection", () => {
  it("serializes stored whole and fractional decimals with the same exact ZAR format as the cart", () => {
    const projected = projectPublicCheckout({ publicReference: "CHK-DISPOSABLE", status: "VALIDATING", currency: "ZAR", version: 2,
      merchandiseSubtotal: new Prisma.Decimal(1500), modifierSubtotal: new Prisma.Decimal("0.50"), deliveryFeeTotal: new Prisma.Decimal("10.01"), grandTotal: new Prisma.Decimal("1510.51"),
      storeGroups: [{ storeId: "store", deliveryFee: new Prisma.Decimal("10.01"), lines: [{ baseUnitPrice: new Prisma.Decimal(1500), modifierUnitTotal: new Prisma.Decimal("0.5"), lineTotal: new Prisma.Decimal("1500.5") }] }],
    });
    expect(projected!.totals).toEqual({ merchandiseSubtotal: "1500.00", modifierSubtotal: "0.50", deliveryFeeTotal: "10.01", grandTotal: "1510.51" });
    expect(projected!.storeGroups[0].lines[0]).toMatchObject({ baseUnitPrice: "1500.00", modifierUnitTotal: "0.50", lineTotal: "1500.50" });
  });
  it("returns only editable owner contact/address facts and excludes verification and serviceability secrets", () => {
    const projected = projectPublicCheckout({ publicReference: "CHK-OWNER", status: "VALIDATING", currency: "ZAR", version: 2,
      customerUserId: "private-owner", guestAccessTokenHash: "private-hash",
      contactSnapshot: { id: "private-contact", recipientName: "Recipient", email: "recipient@example.test", phone: "+27821112233", preferredContactMethod: "EMAIL", verifiedCustomerReference: "private-verification", guestEmailVerifications: [{ codeHash: "private-code" }] },
      addressSnapshot: { id: "private-address", recipientName: "Recipient", line1: "45 Commission St", line2: "Unit 2", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001", country: "South Africa", deliveryInstructions: "Reception", serviceAreaReference: "private-region", serviceabilityEvidence: { privateBoundary: true }, protectedCoordinates: { latitude: -26.2, longitude: 28.0 } },
    });
    expect(projected!.contact).toEqual({ recipientName: "Recipient", email: "recipient@example.test", phone: "+27821112233", preferredContactMethod: "EMAIL" });
    expect(projected!.deliveryAddress).toEqual({ recipientName: "Recipient", line1: "45 Commission St", line2: "Unit 2", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001", country: "South Africa", deliveryInstructions: "Reception" });
    expect(JSON.stringify(projected)).not.toContain("private-");
    expect(projected!.deliveryAddress).not.toHaveProperty("protectedCoordinates");
  });
});
