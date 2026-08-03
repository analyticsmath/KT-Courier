import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const root = process.cwd(); const read = (path: string) => readFileSync(resolve(root, path), "utf8");
describe("marketplace checkout API contract", () => {
  it("contains every customer cart mutation route", () => { for (const path of ["app/api/cart/route.ts", "app/api/cart/lines/route.ts", "app/api/cart/lines/[lineReference]/route.ts", "app/api/cart/lines/[lineReference]/remove/route.ts", "app/api/cart/clear/route.ts", "app/api/cart/claim/route.ts", "app/api/cart/merge/route.ts"]) expect(read(path)).toMatch(/(GET|POST|PATCH)/); });
  it("contains checkout command routes without client totals or payment success", () => { for (const path of ["delivery-quotes", "delivery-options", "review", "acknowledge", "reserve", "prepare-payment", "cancel"]) { const route = read(`app/api/checkout/[reference]/${path}/route.ts`); expect(route).not.toMatch(/grandTotal|deliveryFee|paymentSuccess|markPaid/); expect(route).toMatch(/enforceMarketplaceMutation/); } });
  it("keeps browser pages and status non-authoritative", () => { const returned = read("app/(public)/checkout/[reference]/return/page.tsx"); const status = read("app/(public)/checkout/[reference]/status/page.tsx"); expect(returned).toMatch(/not payment confirmation/); expect(status).toMatch(/cannot consume stock/); });
  it("has no public mark-paid route", () => { const files = ["app/api/checkout/[reference]/route.ts", "app/api/checkout/[reference]/status/route.ts", "app/api/checkout/[reference]/prepare-payment/route.ts"].map(read).join("\n"); expect(files).not.toMatch(/mark-paid|markPaid/); });
});
