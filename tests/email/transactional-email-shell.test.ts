import { describe, expect, it } from "vitest";
import { escapeEmailHtml, renderEmailHtml, renderEmailText, renderPlainTextNotification } from "@/lib/email/email-renderer";

describe("KT Couriers transactional email shell", () => {
  it("includes accessible brand identification and responsive client-compatible structure", () => {
    const html = renderEmailHtml({ title: "Delivery update", body: "<p>On the move.</p>" });
    expect(html).toContain("KT Couriers");
    expect(html).toContain('role="presentation"');
    expect(html).toContain("icon-192.png");
    expect(html).toContain("width:100%;max-width:600px");
    expect(html).toContain("From checkout to doorstep.");
    expect(html).not.toMatch(/background:\s*#(?:f5f5dc|fffff0|fff8dc)/i);
  });

  it("escapes untrusted notification plain text rather than interpreting HTML", () => {
    const html = renderPlainTextNotification("Order <alert>", 'Hello <script>alert("x")</script>\nNext line');
    expect(html).toContain("Order &lt;alert&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<br>Next line");
  });

  it("does not render unsafe CTA URLs", () => {
    expect(() => renderEmailHtml({ title: "Hi", body: "", actionUrl: "javascript:alert(1)" })).toThrow("UNSAFE_EMAIL_ACTION_URL");
    expect(() => renderEmailHtml({ title: "Hi", body: "", actionUrl: "//evil.test/link" })).toThrow("UNSAFE_EMAIL_ACTION_URL");
    expect(renderEmailHtml({ title: "Hi", body: "", actionUrl: "/track", actionLabel: "Track" })).toContain("https://www.ktcouriers.com/track");
  });

  it("escapes quotes, ampersands and less-than characters", () => {
    expect(escapeEmailHtml('<a title="a&b">')).toBe("&lt;a title=&quot;a&amp;b&quot;&gt;");
  });

  it("preserves a text-only fallback for clients that disable HTML", () => {
    expect(renderEmailText("Delivery", "Ready", "/track")).toContain("https://www.ktcouriers.com/track");
  });
});
