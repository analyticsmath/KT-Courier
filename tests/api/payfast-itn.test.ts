import { describe, expect, it } from "vitest";
import * as route from "@/app/api/payments/payfast/itn/route";

const request = (body: BodyInit = "safe", contentType = "application/x-www-form-urlencoded") =>
  new Request("https://app.example.test/api/payments/payfast/itn", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

describe("tombstoned Payfast ITN route", () => {
  it("returns HTTP 410 Gone, never redirects, and sets no-store cache control", async () => {
    expect(route).toHaveProperty("GET");
    expect(route).toHaveProperty("POST");
    const response = await route.POST(request());
    expect(response.status).toBe(410);
    const text = await response.text();
    expect(text).toContain("permanently retired");
    expect(text).toContain("Paystack");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not process payloads or mutate state on incoming requests", async () => {
    const response = await route.POST(request("pf_payment_id=12345&payment_status=COMPLETE"));
    expect(response.status).toBe(410);
  });

  it("has no browser session or same-origin dependency", () => {
    expect(route.POST.toString()).not.toMatch(/getCurrentUser|requireAuth|requireRequestOrigin/);
  });
});

