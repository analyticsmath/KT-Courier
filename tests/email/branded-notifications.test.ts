import { describe, expect, it } from "vitest";
import { renderCanonicalEmail, renderEmailHtml, renderEmailText } from "@/lib/email/email-renderer";
import { renderTemplate } from "@/lib/email/email-templates";
import { EmailTemplateType } from "@/types/db";

describe("KT Couriers transactional email experience", () => {
  it("uses the genuine public logo, neutral palette and accessible email structure", () => {
    const html = renderEmailHtml({ title: "Your parcel is on its way", body: "<p>Delivery confirmed.</p>", actionUrl: "/track", actionLabel: "Track your delivery" });
    expect(html).toContain('https://www.ktcouriers.com/images/kt-couriers/brand/icon-192.png');
    expect(html).toContain('alt="KT Couriers"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('https://www.ktcouriers.com/track');
    expect(html).toContain("From checkout to doorstep.");
    expect(html).not.toMatch(/#f0f4ff|#1D6ADB|#0F2B52|#FAF7EF|#fef3c7/i);
  });

  it("escapes canonical variable data instead of allowing email HTML injection", () => {
    const html = renderCanonicalEmail({ title: 'Update <alert>', body: 'Order <script>alert("x")</script> & ready' });
    expect(html).toContain("&lt;alert&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("offers the public tracking journey for genuine delivery status events", () => {
    const html = renderCanonicalEmail({ title: "KT Couriers: delivery for 123 updated", body: "Delivery for store order 123: in transit." });
    expect(html).toContain('href="https://www.ktcouriers.com/track"');
    expect(html).toContain("Track your delivery");
  });

  it("does not falsely imply a checkout has an active courier tracking number", () => {
    const html = renderCanonicalEmail({ title: "KT Couriers: marketplace order 52 confirmed", body: "Your marketplace order is confirmed." });
    expect(html).not.toContain('href="https://www.ktcouriers.com/track" style="display:inline-block');
  });

  it("uses the approved internal action route ahead of a tracking fallback", () => {
    const html = renderCanonicalEmail({ title: "KT Couriers: delivery update", body: "Your order is ready.", actionRoute: "/account/orders" });
    expect(html).toContain('href="https://www.ktcouriers.com/account/orders"');
  });

  it("rejects off-domain actions and unsafe URI schemes", () => {
    expect(() => renderEmailHtml({ title: "Security", body: "Check", actionUrl: "javascript:alert(1)" })).toThrow();
    expect(() => renderEmailHtml({ title: "Security", body: "Check", actionUrl: "https://phishing.example/reset" })).toThrow();
    expect(() => renderEmailHtml({ title: "Security", body: "Check", actionUrl: "//phishing.example" })).toThrow();
  });

  it("escapes dynamic OTP greeting markup and retains the exact plaintext alternative", () => {
    const greeting = "<strong>Customer</strong>";
    const email = renderTemplate(EmailTemplateType.EMAIL_VERIFICATION_OTP, {
      name: greeting,
      otp: "143029",
      expiresMinutes: 15,
    });
    expect(email.html).toContain("&lt;strong&gt;Customer&lt;/strong&gt;");
    expect(email.text).toContain(greeting);
    expect(email.html).toContain("143029");
    expect(email.text).toContain("143029");
  });

  it("preserves a useful plain-text alternative", () => {
    expect(renderEmailText("Delivery confirmed", "Reference KT-123", "/track")).toContain("Reference KT-123");
    expect(renderEmailText("Delivery confirmed", "Reference KT-123", "/track")).toContain("/track");
  });
});
