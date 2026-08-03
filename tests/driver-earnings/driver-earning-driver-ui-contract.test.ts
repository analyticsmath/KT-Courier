import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
const source = readFileSync(join(process.cwd(), "app/(driver)/driver/earnings/page.tsx"), "utf8") + readFileSync(join(process.cwd(), "app/(driver)/driver/earnings/[publicReference]/page.tsx"), "utf8");
it("uses exact heading and safe metrics", () => expect(source).toMatch(/title="Earnings"[\s\S]*Payable balance[\s\S]*Refund reserved/));
it("has no customer, GPS, account, release or payout control", () => expect(source).not.toMatch(/customer(?:Name|Email|Address)|latitude|longitude|accountId|ReleaseForm|PayoutForm/));
