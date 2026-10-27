import { describe, expect, it } from "vitest";
import { publicDeliveryCompletionNote } from "@/lib/driver-operations/delivery-public-note";

describe("proof-of-delivery public status privacy", () => {
  it("does not reveal the signed recipient name in the public tracking status", () => {
    expect(publicDeliveryCompletionNote(null)).toBe("Your parcel has been delivered.");
    expect(publicDeliveryCompletionNote("Left with customer at entrance")).toBe("Left with customer at entrance");
  });
});
