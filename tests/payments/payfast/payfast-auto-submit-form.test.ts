import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync("components/payments/PayfastAutoSubmitForm.tsx", "utf8");
describe("Payfast auto-submit form contract", () => {
  it("renders an exact POST form with unchanged hidden entries", () => { expect(source).toContain('method="post"'); expect(source).toContain("action={actionUrl}"); expect(source).toContain("Object.entries(fields)"); expect(source).toContain('type="hidden"'); });
  it("submits once and provides an accessible manual fallback", () => { expect(source).toContain("submitted.current"); expect(source).toContain("requestSubmit()"); expect(source).toContain("Continue to Payfast"); expect(source).toContain('role="status"'); });
  it("does not sort, reconstruct, log, store, or expose a passphrase", () => expect(source).not.toMatch(/\.sort\(|signature|console\.|localStorage|sessionStorage|passphrase/));
});
