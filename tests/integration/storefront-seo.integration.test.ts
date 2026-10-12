import { describe, expect, it } from "vitest";
import { storefrontVariantJsonLd } from "@/lib/storefront/seo/storefront-structured-data";
import { storefrontProductCanonical } from "@/lib/storefront/seo/storefront-canonical-policy";
import { createStorefrontFixture } from "./storefront-fixtures";

describe("storefront SEO from canonical publication evidence", () => {
  it("emits exact public price and stock without private source identifiers", async () => {
    const f = await createStorefrontFixture();
    const document = await f.projections.buildPublishedSnapshot(f.snapshot.publicReference);
    const json = storefrontVariantJsonLd(document);
    expect(JSON.parse(json)).toMatchObject({ "@type": "Product", name: f.source.product.title, offers: { price: "100.00", priceCurrency: "ZAR", availability: "https://schema.org/InStock" } });
    expect(json).not.toContain(f.source.adminUser.id);
    expect(json).not.toContain(f.source.adminUser.email);
    expect(storefrontProductCanonical(document.productSlug, document.productReference)).toContain(document.productReference);
    const unsafe = storefrontVariantJsonLd({ ...document, title: "</script><script>alert(1)</script>" });
    expect(unsafe).not.toContain("<script>");
    expect(JSON.parse(unsafe).name).toBe("</script><script>alert(1)</script>");
  });
});
